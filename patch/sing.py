# -*- coding: utf-8 -*-
"""生成一段带伴奏的 AI 唱歌 WAV（小星星，公版旋律）。

流程：Breeze TTS 逐句合成 → ffmpeg 变调到旋律音高 → 与程序生成的钢琴/贝斯伴奏混合。
"""
import argparse
import json
import math
import os
import subprocess
import sys
import tempfile
import wave

import numpy as np
import requests

# C 大调小星星，8 个乐句；歌词为公版童谣。
NOTES = [60, 60, 67, 67, 69, 69, 67, 65]
LYRICS = ["一闪", "一闪", "亮晶晶", "满天", "都是", "小星星", "挂在天上", "放光明"]
NOTE_SEC = 0.72
SR = 44100
INTRO = 1.2
OUTRO = 1.6
CHORDS = [
    [261.63, 329.63, 392.00],  # C
    [261.63, 329.63, 392.00],
    [349.23, 440.00, 523.25],  # F
    [392.00, 493.88, 587.33],  # G
]


def decrypt_key(path):
    if not os.path.exists(path):
        return ""
    try:
        import win32crypt
        return win32crypt.CryptUnprotectData(open(path, "rb").read())[1].decode("utf-8").strip()
    except Exception:
        return ""


def ffmpeg_exe():
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        pass
    cand = os.path.join(os.path.dirname(sys.executable), "Lib", "site-packages", "imageio_ffmpeg", "binaries")
    if os.path.isdir(cand):
        for f in os.listdir(cand):
            if f.lower().startswith("ffmpeg") and f.lower().endswith(".exe"):
                return os.path.join(cand, f)
    return ""


def tts(text, key, voice, model, out):
    body = {"text": text, "model_id": model, "instructions": "中文女声，轻柔、自然地唱出来，吐字清楚。"}
    last = None
    for _ in range(3):
        try:
            r = requests.post(
                "https://api.breeze.blue/v1/text-to-speech/" + voice + "?output_format=wav&delivery=sync",
                headers={"xi-api-key": key, "Content-Type": "application/json"},
                json=body, timeout=60,
                proxies={"http": None, "https": None},
            )
            if r.status_code != 200:
                raise RuntimeError("Breeze TTS HTTP %s" % r.status_code)
            with open(out, "wb") as f:
                f.write(r.content)
            if os.path.getsize(out) < 1000:
                raise RuntimeError("empty TTS wav")
            return
        except Exception as exc:
            last = exc
    raise last


def read_wav(path):
    with wave.open(path, "rb") as w:
        n = w.getnframes(); ch = w.getnchannels(); sr = w.getframerate(); sw = w.getsampwidth()
        raw = w.readframes(n)
    if sw != 2:
        raise RuntimeError("only 16-bit wav")
    a = np.frombuffer(raw, dtype="<i2").astype(np.float32) / 32768.0
    if ch > 1:
        a = a.reshape(-1, ch).mean(axis=1)
    return a, sr


def resample(x, sr_from, sr_to):
    if sr_from == sr_to or len(x) == 0:
        return x
    n = int(round(len(x) * sr_to / sr_from))
    old = np.linspace(0, 1, len(x), endpoint=False)
    new = np.linspace(0, 1, n, endpoint=False)
    return np.interp(new, old, x).astype(np.float32)


def fit(x, seconds, sr=SR, fade=0.03):
    n = max(1, int(round(seconds * sr)))
    if len(x) >= n:
        x = x[:n]
    else:
        x = np.pad(x, (0, n - len(x)))
    f = min(int(fade * sr), n // 4)
    if f > 0:
        x[:f] *= np.linspace(0, 1, f)
        x[-f:] *= np.linspace(1, 0, f)
    return x


def pitch_shift(src, dst, semitones, ff):
    if ff:
        rate = 2.0 ** (semitones / 12.0)
        tempo = max(0.5, min(2.0, 1.0 / rate))
        filt = "asetrate=24000*%.6f,atempo=%.6f" % (rate, tempo)
        p = subprocess.run([ff, "-hide_banner", "-loglevel", "error", "-y", "-i", src,
                            "-filter:a", filt, "-ac", "1", "-ar", "24000", dst], capture_output=True)
        if p.returncode == 0 and os.path.exists(dst):
            return read_wav(dst)[0], 24000
    x, sr = read_wav(src)
    rate = 2.0 ** (semitones / 12.0)
    return resample(x, sr, int(sr * rate)), int(sr * rate)


def envelope(n, sr, attack=0.01, release=0.12):
    e = np.ones(n, dtype=np.float32)
    a = min(int(attack * sr), n // 2)
    r = min(int(release * sr), n // 2)
    if a: e[:a] *= np.linspace(0, 1, a)
    if r: e[-r:] *= np.linspace(1, 0, r)
    return e


def synth_note(freq, dur, sr=SR, amp=0.18):
    n = int(dur * sr)
    t = np.arange(n) / sr
    x = (np.sin(2 * math.pi * freq * t) * 0.65
         + np.sin(2 * math.pi * freq * 2 * t) * 0.18
         + np.sin(2 * math.pi * freq * 3 * t) * 0.08)
    return (x * envelope(n, sr) * amp).astype(np.float32)


def accompaniment(total):
    n = int(total * SR)
    out = np.zeros(n, dtype=np.float32)
    # 4 小节和弦，每小节 2.88 秒（8 个乐句的总和）
    bar = NOTE_SEC * 2
    idx = 0
    t0 = INTRO
    while t0 < INTRO + NOTE_SEC * len(LYRICS):
        chord = CHORDS[idx % len(CHORDS)]
        # 低音
        b = synth_note(chord[0] / 2, min(bar, total - t0), amp=0.13)
        a = int(t0 * SR); out[a:a + len(b)] += b[:max(0, n - a)]
        # 分解和弦
        for j in range(8):
            tt = t0 + j * bar / 8
            if tt >= total: break
            note = chord[j % 3] * (2 if j % 4 == 2 else 1)
            z = synth_note(note, bar / 8 * 0.82, amp=0.075)
            k = int(tt * SR); out[k:k + len(z)] += z[:max(0, n - k)]
        idx += 1
        t0 += bar
    # 轻微底鼓
    for k in range(int(total / 0.72)):
        st = int((INTRO + k * 0.72) * SR)
        if st >= n: break
        ln = int(0.08 * SR)
        env = np.exp(-np.linspace(0, 1, ln) * 9)
        out[st:st + ln] += (np.sin(2 * math.pi * 55 * np.arange(ln) / SR) * env * 0.18).astype(np.float32)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", required=True)
    ap.add_argument("--output", required=True)
    args = ap.parse_args()
    root = os.path.abspath(args.root)
    os.makedirs(os.path.dirname(os.path.abspath(args.output)), exist_ok=True)
    keyfile = os.path.join(root, "data", "voice-send-breeze.key")
    key = decrypt_key(keyfile)
    if not key:
        raise SystemExit("Breeze key missing")
    settings = {}
    try:
        settings = json.loads(open(os.path.join(root, "data", "voice-send.json"), encoding="utf-8-sig").read())
    except Exception:
        pass
    profile = (settings.get("Profiles") or {}).get("breezeblue") or {}
    voice = profile.get("Voice") or settings.get("Voice") or "voc_u3nxkd5578wc"
    model = profile.get("Model") or settings.get("Model") or "breeze-tts-2"
    ff = ffmpeg_exe()
    total = INTRO + NOTE_SEC * len(LYRICS) + OUTRO
    vocal = np.zeros(int(total * SR), dtype=np.float32)
    with tempfile.TemporaryDirectory(prefix="whale-sing-") as td:
        for i, (text, midi) in enumerate(zip(LYRICS, NOTES)):
            raw = os.path.join(td, "t%d.wav" % i)
            tts(text, key, voice, model, raw)
            shifted, sr = pitch_shift(raw, os.path.join(td, "s%d.wav" % i), midi - 60, ff)
            shifted = resample(shifted, sr, SR)
            seg = fit(shifted, NOTE_SEC)
            at = int((INTRO + i * NOTE_SEC) * SR)
            vocal[at:at + len(seg)] += seg
    acc = accompaniment(total)
    mix = vocal * 0.92 + acc * 0.55
    peak = max(1e-6, float(np.max(np.abs(mix))))
    mix = mix / peak * 0.92
    # 立体声：轻微延迟营造空间感
    left = mix
    right = np.roll(mix, int(0.008 * SR)) * 0.98
    stereo = np.empty(len(left) * 2, dtype=np.int16)
    stereo[0::2] = np.clip(left, -1, 1) * 32767
    stereo[1::2] = np.clip(right, -1, 1) * 32767
    with wave.open(args.output, "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes(stereo.tobytes())
    print("sung", args.output, round(len(mix) / SR, 2), "s")


if __name__ == "__main__":
    main()
