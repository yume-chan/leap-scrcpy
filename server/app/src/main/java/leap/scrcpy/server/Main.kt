package leap.scrcpy.server

import android.annotation.SuppressLint
import android.content.res.Configuration
import android.graphics.Rect
import android.hardware.display.DisplayManager
import android.hardware.display.DisplayManager.DisplayListener
import android.os.Build
import android.os.Handler
import android.os.HandlerThread
import android.os.IBinder
import android.os.Looper
import android.provider.Settings
import android.util.Log
import android.view.IDisplayWindowListener
import leap.scrcpy.server.messages.ClipboardMessage
import leap.scrcpy.server.messages.DisplayInfoMessage
import leap.scrcpy.server.messages.VersionMessage
import leap.scrcpy.server.request.ClipboardRequest
import leap.scrcpy.server.request.UHidRequest
import org.joor.Reflect
import java.io.DataInputStream
import java.io.DataOutputStream

@SuppressLint("DiscouragedPrivateApi", "PrivateApi")
object Main {
    private val displayManagerGlobal: Reflect by lazy {
        Reflect.onClass("android.hardware.display.DisplayManagerGlobal").call("getInstance")
    }

    private var resetShowTouches = false

    private fun getDisplayInfo(): DisplayInfoMessage {
        val displayInfo = displayManagerGlobal.call("getDisplayInfo", 0)
        return DisplayInfoMessage(
            displayInfo.call("getNaturalWidth").get(),
            displayInfo.call("getNaturalHeight").get(),
            displayInfo.get("rotation")
        )
    }

    @JvmStatic
    fun main(vararg args: String) {
        Looper.prepare()

        val outputStream = DataOutputStream(System.out)
        VersionMessage.serialize(outputStream)

        var lastDisplayInfo = getDisplayInfo()
        lastDisplayInfo.serialize(outputStream)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            val windowManagerBinder =
                Reflect.onClass("android.os.ServiceManager").call("getService", "window")
                    .get<IBinder>()
            val windowManager = Reflect.onClass("android.view.IWindowManager\$Stub")
                .call("asInterface", windowManagerBinder)
            windowManager.call(
                "registerDisplayWindowListener",
                object : IDisplayWindowListener.Stub() {
                    override fun onDisplayAdded(displayId: Int) {}

                    override fun onDisplayConfigurationChanged(
                        displayId: Int, newConfig: Configuration
                    ) {
                        if (displayId != 0) {
                            return
                        }

                        val displayInfo = getDisplayInfo()
                        if (displayInfo != lastDisplayInfo) {
                            displayInfo.serialize(outputStream)
                            Log.e(
                                "LeapScrcpy",
                                "onDisplayConfigurationChanged ${displayInfo.width} ${displayInfo.height} ${displayInfo.rotation}"
                            )
                            lastDisplayInfo = displayInfo
                        }
                    }

                    override fun onDisplayRemoved(displayId: Int) {}

                    override fun onFixedRotationStarted(displayId: Int, newRotation: Int) {}

                    override fun onFixedRotationFinished(displayId: Int) {}

                    override fun onKeepClearAreasChanged(
                        displayId: Int,
                        restricted: MutableList<Rect>?,
                        unrestricted: MutableList<Rect>?
                    ) {
                    }
                })
        } else {
            val handlerThread = HandlerThread("DisplayListener").apply { start() }
            val handler = Handler(handlerThread.getLooper())

            val displayManager = FakeContext.instance.getSystemService(DisplayManager::class.java)!!
            displayManager.registerDisplayListener(object : DisplayListener {
                override fun onDisplayAdded(displayId: Int) {
                }

                override fun onDisplayRemoved(displayId: Int) {
                }

                override fun onDisplayChanged(displayId: Int) {
                    if (displayId != 0) {
                        return
                    }

                    val displayInfo = getDisplayInfo()
                    if (displayInfo != lastDisplayInfo) {
                        displayInfo.serialize(outputStream)
                        lastDisplayInfo = displayInfo
                    }
                }

            }, handler)
        }

        ClipboardRequest.clipboardManager.addPrimaryClipChangedListener {
            val content =
                ClipboardRequest.clipboardManager.primaryClip?.getItemAt(0)?.text.toString()
            ClipboardMessage(content).serialize(outputStream)
        }

        resetShowTouches =
            Settings.System.getInt(FakeContext.contentResolver, "show_touches", 0) != 0
        Settings.System.putInt(FakeContext.contentResolver, "show_touches", 1)

        try {
            val inputStream = DataInputStream(System.`in`)
            while (true) {
                val type = inputStream.readInt()
                when (type) {
                    0 -> ClipboardRequest.deserialize(inputStream).run(outputStream)
                    1 -> UHidRequest.deserialize(inputStream).run(outputStream)
                    else -> throw IndexOutOfBoundsException()
                }
            }
        } finally {
            if (resetShowTouches) {
                Settings.System.putInt(FakeContext.contentResolver, "show_touches", 0)
            }
        }
    }
}