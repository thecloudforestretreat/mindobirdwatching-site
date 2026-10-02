import AppKit
import Foundation
import PDFKit
import Vision

struct Extraction: Codable {
    let text: String
    let images: [String]
}

func fail(_ message: String) -> Never {
    FileHandle.standardError.write(Data((message + "\n").utf8))
    exit(1)
}

guard CommandLine.arguments.count == 3 else {
    fail("Usage: document_extract input-file output-directory")
}

let input = URL(fileURLWithPath: CommandLine.arguments[1])
let output = URL(fileURLWithPath: CommandLine.arguments[2], isDirectory: true)

func recognizeText(_ image: CGImage) -> String {
    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.usesLanguageCorrection = true
    request.recognitionLanguages = ["en-US", "es-EC"]

    do {
        try VNImageRequestHandler(cgImage: image, options: [:]).perform([request])
    } catch {
        return ""
    }

    let observations = (request.results ?? []).sorted { left, right in
        let verticalDifference = abs(left.boundingBox.maxY - right.boundingBox.maxY)
        if verticalDifference > 0.012 {
            return left.boundingBox.maxY > right.boundingBox.maxY
        }
        return left.boundingBox.minX < right.boundingBox.minX
    }
    return observations.compactMap { $0.topCandidates(1).first?.string }.joined(separator: "\n")
}

let imageExtensions = ["jpg", "jpeg", "png", "webp"]
if imageExtensions.contains(input.pathExtension.lowercased()) {
    guard let image = NSImage(contentsOf: input),
          let data = image.tiffRepresentation,
          let bitmap = NSBitmapImageRep(data: data),
          let cgImage = bitmap.cgImage else {
        fail("The image could not be opened")
    }
    let result = Extraction(text: recognizeText(cgImage), images: [])
    let encoder = JSONEncoder()
    guard let encoded = try? encoder.encode(result) else {
        fail("Could not encode image extraction results")
    }
    FileHandle.standardOutput.write(encoded)
    exit(0)
}

guard input.pathExtension.lowercased() == "pdf",
      let document = PDFDocument(url: input) else {
    fail("The document could not be opened")
}

let pageLimit = min(document.pageCount, 12)
var pageText: [String] = []

for index in 0..<pageLimit {
    if let value = document.page(at: index)?.string?.trimmingCharacters(in: .whitespacesAndNewlines),
       !value.isEmpty {
        pageText.append("Page \(index + 1)\n\(value)")
    }
}

let combined = pageText.joined(separator: "\n\n")
var imagePaths: [String] = []

if combined.count < 80 {
    do {
        try FileManager.default.createDirectory(at: output, withIntermediateDirectories: true)
    } catch {
        fail("Could not create the PDF render directory")
    }

    for index in 0..<min(pageLimit, 8) {
        guard let page = document.page(at: index) else { continue }
        let bounds = page.bounds(for: .mediaBox)
        let width: CGFloat = 1800
        let height = max(1, width * bounds.height / max(bounds.width, 1))
        let image = page.thumbnail(of: NSSize(width: width, height: height), for: .mediaBox)
        guard let tiff = image.tiffRepresentation,
              let bitmap = NSBitmapImageRep(data: tiff),
              let png = bitmap.representation(using: .png, properties: [:]) else {
            continue
        }
        let destination = output.appendingPathComponent(String(format: "page-%02d.png", index + 1))
        do {
            try png.write(to: destination, options: .atomic)
            imagePaths.append(destination.path)
        } catch {
            fail("Could not render a PDF page")
        }
    }
}

let result = Extraction(text: combined, images: imagePaths)
let encoder = JSONEncoder()

guard let encoded = try? encoder.encode(result) else {
    fail("Could not encode PDF extraction results")
}

FileHandle.standardOutput.write(encoded)
