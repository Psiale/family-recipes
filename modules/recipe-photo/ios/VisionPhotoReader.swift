import Foundation
import ImageIO
import Vision

enum PhotoError: Error { case invalidImage }

// Shared vendor-SDK logic, separately typechecked against the iOS deployment target.
struct VisionPhotoReader {
  static func read(uri: String, language: String, cacheRoot: URL) throws -> String {
    guard let url = URL(string: uri), url.isFileURL,
          url.host == nil || url.host == "" || url.host == "localhost",
          url.resolvingSymlinksInPath().path.hasPrefix(cacheRoot.resolvingSymlinksInPath().path + "/"),
          let size = try url.resourceValues(forKeys: [.fileSizeKey]).fileSize,
          size > 0, size <= 30 * 1024 * 1024,
          let source = CGImageSourceCreateWithURL(url as CFURL, nil),
          let properties = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any],
          let width = properties[kCGImagePropertyPixelWidth] as? Int,
          let height = properties[kCGImagePropertyPixelHeight] as? Int,
          (1...2000).contains(width), (1...2000).contains(height)
    else { throw PhotoError.invalidImage }
    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.recognitionLanguages = language == "en" ? ["en-US", "es-ES"] : ["es-ES", "en-US"]
    request.automaticallyDetectsLanguage = true
    request.usesLanguageCorrection = true
    try VNImageRequestHandler(url: url, options: [:]).perform([request])
    return (request.results ?? []).compactMap { $0.topCandidates(1).first?.string }.joined(separator: "\n")
  }
}
