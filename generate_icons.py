#!/usr/bin/env python3
import os, struct, zlib

def create_png(size, filename):
    """단순 초록색 배경 + 불꽃 이모지 느낌의 PNG 아이콘 생성"""
    w = h = size
    # RGBA 픽셀 데이터 생성
    pixels = []
    cx, cy = w // 2, h // 2
    r_outer = w * 0.45
    r_inner = w * 0.3

    for y in range(h):
        row = []
        for x in range(w):
            dx, dy = x - cx, y - cy
            dist = (dx*dx + dy*dy) ** 0.5
            # 둥근 배경
            if dist <= r_outer:
                # 배경 색: #1D9E75
                row += [0x1D, 0x9E, 0x75, 255]
                # 중앙 흰 원
                if dist <= r_inner * 0.5:
                    row[-4:] = [255, 255, 255, 255]
            else:
                row += [0, 0, 0, 0]
        pixels.append(bytes(row))

    def make_chunk(chunk_type, data):
        c = chunk_type + data
        return struct.pack('>I', len(data)) + c + struct.pack('>I', zlib.crc32(c) & 0xffffffff)

    sig = b'\x89PNG\r\n\x1a\n'
    ihdr_data = struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0)  # RGB
    # 실제로는 RGBA (color type 6)
    ihdr_data = struct.pack('>II', w, h) + bytes([8, 6, 0, 0, 0])
    ihdr = make_chunk(b'IHDR', ihdr_data)

    raw = b''
    for row in pixels:
        raw += b'\x00' + row  # filter type 0
    compressed = zlib.compress(raw, 9)
    idat = make_chunk(b'IDAT', compressed)
    iend = make_chunk(b'IEND', b'')

    with open(filename, 'wb') as f:
        f.write(sig + ihdr + idat + iend)
    print(f"생성: {filename} ({size}x{size})")

os.makedirs('icons', exist_ok=True)
create_png(192, 'icons/icon-192.png')
create_png(512, 'icons/icon-512.png')
create_png(96,  'icons/icon-96.png')
print("아이콘 생성 완료!")
