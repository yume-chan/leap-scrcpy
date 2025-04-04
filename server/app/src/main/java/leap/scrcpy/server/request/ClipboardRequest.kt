package leap.scrcpy.server.request

import android.content.ClipData
import android.content.ClipboardManager
import leap.scrcpy.server.FakeContext
import leap.scrcpy.server.Request
import leap.scrcpy.server.RequestFactory
import java.io.DataInputStream
import java.io.DataOutputStream

data class ClipboardRequest(val content: String) : Request {
    companion object : RequestFactory<ClipboardRequest> {
        val clipboardManager: ClipboardManager by lazy {
            FakeContext.instance.getSystemService(
                ClipboardManager::class.java
            )
        }

        override fun deserialize(stream: DataInputStream): ClipboardRequest {
            with(stream) {
                val length = readInt()
                val content = ByteArray(length)
                readFully(content)
                return ClipboardRequest(content.decodeToString())
            }
        }
    }

    override fun run(output: DataOutputStream) {
        clipboardManager.setPrimaryClip(
            ClipData.newPlainText(null, content)
        )
    }
}
