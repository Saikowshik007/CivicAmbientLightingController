"""Packet reference for Dynamic ambient lighting com.findn.htx 1.1.1.
No Bluetooth operations. Values and returned bytes use unsigned notation.
"""
def frame(command, *data):
    if not all(isinstance(x, int) and 0 <= x <= 255 for x in (command, *data)):
        raise ValueError("command and data must be bytes")
    length = len(data) + 1
    if length > 255:
        raise ValueError("payload too long")
    checksum = (~(length + command + sum(data))) & 255
    return bytes((252, length, command, *data, checksum, 250))


def colors(part_one, part_two):
    if len(part_one) != 3 or len(part_two) != 3:
        raise ValueError("each zone needs RGB")
    return frame(4, *part_one, *part_two)


def brightness(part_one, part_two):
    if not (0 <= part_one <= 100 and 0 <= part_two <= 100):
        raise ValueError("brightness must be 0..100")
    return frame(2, part_one, part_two)


def rgb_modes(part_one, part_two):
    if part_one not in (0,1,2,3,4,6) or part_two not in (0,1,2,3,4,6):
        raise ValueError("unknown RGB mode")
    return frame(3, part_one, part_two)


def flow(mode, variant=0):
    if mode not in range(4,15) or variant not in range(6):
        raise ValueError("unknown flow mode or variant")
    if mode == 10 and variant > 1:
        raise ValueError("sync selects part one or part two")
    return frame(34, mode | (variant << 4))
