# ML Kit discovers registrars by name and invokes their zero-argument constructors.
# R8 full mode otherwise removes these constructors in optimized release builds.
-keep class com.google.mlkit.** implements com.google.firebase.components.ComponentRegistrar {
  public <init>();
}
