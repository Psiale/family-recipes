package com.familyrecipetree.photo

import android.graphics.BitmapFactory
import android.net.Uri
import android.os.Handler
import android.os.Looper
import com.google.android.gms.common.moduleinstall.InstallStatusListener
import com.google.android.gms.common.moduleinstall.ModuleInstall
import com.google.android.gms.common.moduleinstall.ModuleInstallRequest
import com.google.android.gms.common.moduleinstall.ModuleInstallStatusUpdate.InstallState
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.util.concurrent.atomic.AtomicBoolean

class RecipePhotoModule : Module() {
  private val recognizing = AtomicBoolean(false)

  override fun definition() = ModuleDefinition {
    Name("RecipePhoto")
    AsyncFunction("prepareAsync") { promise: Promise ->
      val context = appContext.reactContext
      if (context == null) { promise.reject("ERR_PHOTO_READER", "Photo reader context unavailable", null); return@AsyncFunction }
      val reader = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
      val installer = ModuleInstall.getClient(context)
      val handler = Handler(Looper.getMainLooper())
      val settled = AtomicBoolean(false)
      lateinit var listener: InstallStatusListener
      lateinit var timeout: Runnable
      fun finish(success: Boolean, cause: Exception? = null) {
        if (!settled.compareAndSet(false, true)) return
        handler.removeCallbacks(timeout)
        installer.unregisterListener(listener)
        reader.close()
        if (success) promise.resolve()
        else promise.reject("ERR_PHOTO_READER", "Prepare the local reader with Google Play services and an internet connection", cause)
      }
      listener = InstallStatusListener { update ->
        when (update.installState) {
          InstallState.STATE_COMPLETED -> finish(true)
          InstallState.STATE_FAILED, InstallState.STATE_CANCELED -> finish(false, IllegalStateException("Google model installation status: ${update.errorCode}"))
        }
      }
      timeout = Runnable { finish(false) }
      handler.postDelayed(timeout, 90000)
      installer.areModulesAvailable(reader)
        .addOnSuccessListener { response ->
          if (settled.get()) return@addOnSuccessListener
          if (response.areModulesAvailable()) finish(true)
          else installer.installModules(ModuleInstallRequest.newBuilder().addApi(reader).setListener(listener).build())
            .addOnSuccessListener { if (it.areModulesAlreadyInstalled()) finish(true) }
            .addOnFailureListener { finish(false, it) }
        }
        .addOnFailureListener { finish(false, it) }
    }
    AsyncFunction("recognizeAsync") { uri: String, _: String, promise: Promise ->
      val context = appContext.reactContext
      if (context == null || !recognizing.compareAndSet(false, true)) {
        promise.reject("ERR_PHOTO_BUSY", "Photo reader unavailable or busy", null); return@AsyncFunction
      }
      try {
        val parsed = Uri.parse(uri)
        require(parsed.scheme == "file")
        val file = File(requireNotNull(parsed.path)).canonicalFile
        require(file.path.startsWith(context.cacheDir.canonicalPath + File.separator))
        require(file.isFile && file.length() in 1..(30L * 1024 * 1024))
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeFile(file.path, bounds)
        require(bounds.outWidth in 1..2000 && bounds.outHeight in 1..2000)
        val image = InputImage.fromFilePath(context, Uri.fromFile(file))
        val reader = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
        val settled = AtomicBoolean(false)
        val handler = Handler(Looper.getMainLooper())
        val timeout = Runnable { if (settled.compareAndSet(false,true)) promise.reject("ERR_PHOTO_TIMEOUT", "Photo reading timed out", null) }
        handler.postDelayed(timeout, 60000)
        reader.process(image)
          .addOnSuccessListener { if (settled.compareAndSet(false,true)) promise.resolve(it.text) }
          .addOnFailureListener { if (settled.compareAndSet(false,true)) promise.reject("ERR_PHOTO_READ", "Photo reading failed", null) }
          .addOnCompleteListener { handler.removeCallbacks(timeout); reader.close(); recognizing.set(false) }
      } catch (_: Exception) {
        recognizing.set(false)
        promise.reject("ERR_PHOTO_IMAGE", "Expected a bounded image in the app cache", null)
      }
    }
  }
}
