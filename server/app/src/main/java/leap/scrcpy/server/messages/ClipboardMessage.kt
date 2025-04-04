package leap.scrcpy.server.messages

import leap.scrcpy.server.Message
import java.io.DataOutputStream

data class ClipboardMessage(val content: CharSequence) : Message {
    override fun serialize(stream: DataOutputStream) {
        synchronized(stream) {
            with(stream) {
                writeInt(2)
                val bytes = content.toString().encodeToByteArray()
                writeInt(bytes.size)
                write(bytes)
                flush()
            }
        }
    }
}
