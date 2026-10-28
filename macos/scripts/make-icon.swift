// Renders macos/AppIcon.icns from the site's logo sticker: the sticker on a navy rounded
// square, at every size macOS asks for. Run via macos/build.sh when AppIcon.icns is missing.
import AppKit

let args = CommandLine.arguments
guard args.count == 3, let logo = NSImage(contentsOfFile: args[1]) else {
    print("usage: make-icon.swift <logo.svg> <out.iconset>")
    exit(1)
}
let iconset = URL(fileURLWithPath: args[2])
try? FileManager.default.createDirectory(at: iconset, withIntermediateDirectories: true)

func render(_ pixels: Int) -> Data {
    let rep = NSBitmapImageRep(
        bitmapDataPlanes: nil, pixelsWide: pixels, pixelsHigh: pixels, bitsPerSample: 8,
        samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB,
        bytesPerRow: 0, bitsPerPixel: 0
    )!
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
    let size = CGFloat(pixels)
    // macOS icon grid: the shape fills ~80% of the canvas
    let inset = size * 0.1
    let tile = NSRect(x: inset, y: inset, width: size - inset * 2, height: size - inset * 2)
    let path = NSBezierPath(roundedRect: tile, xRadius: tile.width * 0.225, yRadius: tile.width * 0.225)
    NSGradient(
        starting: NSColor(red: 0x0B / 255, green: 0x51 / 255, blue: 0x8D / 255, alpha: 1), // the site's blues
        ending: NSColor(red: 0x02 / 255, green: 0x33 / 255, blue: 0x5E / 255, alpha: 1)
    )!.draw(in: path, angle: -90)
    let logoHeight = tile.height * 0.84
    let logoWidth = logoHeight * logo.size.width / logo.size.height
    logo.draw(in: NSRect(x: tile.midX - logoWidth / 2, y: tile.midY - logoHeight / 2 - tile.height * 0.02,
                         width: logoWidth, height: logoHeight))
    NSGraphicsContext.restoreGraphicsState()
    return rep.representation(using: .png, properties: [:])!
}

for base in [16, 32, 128, 256, 512] {
    try! render(base).write(to: iconset.appendingPathComponent("icon_\(base)x\(base).png"))
    try! render(base * 2).write(to: iconset.appendingPathComponent("icon_\(base)x\(base)@2x.png"))
}
