require 'json'
package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))
Pod::Spec.new do |s|
  s.name = 'RecipePhoto'
  s.version = package['version']
  s.summary = package['description']
  s.description = package['description']
  s.license = package['license']
  s.author = 'Family Recipes'
  s.homepage = 'https://github.com/Psiale/family-recipes'
  s.platforms = { :ios => '16.4' }
  s.swift_version = '5.9'
  s.source = { :git => 'https://github.com/Psiale/family-recipes.git' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.frameworks = 'Vision', 'ImageIO'
  s.source_files = '**/*.swift'
end
