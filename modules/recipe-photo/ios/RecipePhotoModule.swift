import ExpoModulesCore
import Foundation

public class RecipePhotoModule: Module {
  private let queue = DispatchQueue(label: "com.familyrecipetree.photo", qos: .userInitiated)

  public func definition() -> ModuleDefinition {
    Name("RecipePhoto")
    // Vision is supplied by iOS; no model download or external inference service.
    AsyncFunction("prepareAsync") { }
    AsyncFunction("recognizeAsync") { (uri: String, language: String) throws -> String in
      guard let cache = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first
      else { throw PhotoError.invalidImage }
      return try VisionPhotoReader.read(uri: uri, language: language, cacheRoot: cache)
    }.runOnQueue(queue)
  }
}
