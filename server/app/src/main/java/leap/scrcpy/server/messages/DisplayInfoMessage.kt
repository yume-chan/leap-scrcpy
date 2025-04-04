package leap.scrcpy.server.messages

import leap.scrcpy.server.Message
import java.io.DataOutputStream

data class DisplayInfoMessage(val width: Int, val height: Int, val rotation: Int) : Message {
    override fun serialize(stream: DataOutputStream) {
        synchronized(stream) {
            with(stream) {
                writeInt(1)
                writeInt(width)
                writeInt(height)
                writeInt(rotation)
                flush()
            }
        }
    }
}
