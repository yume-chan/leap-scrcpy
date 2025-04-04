package leap.scrcpy.server.messages

import leap.scrcpy.server.Message
import java.io.DataOutputStream

object VersionMessage : Message {
    override fun serialize(stream: DataOutputStream) {
        synchronized(stream) {
            with(stream) {
                writeInt(0)
                writeInt(1) // major
                writeInt(0) // minor
                flush()
            }
        }
    }
}