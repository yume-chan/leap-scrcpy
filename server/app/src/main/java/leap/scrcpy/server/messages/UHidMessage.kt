package leap.scrcpy.server.messages

import leap.scrcpy.server.Message
import java.io.DataOutputStream

data class UHidMessage(val id: Int, val data: ByteArray) : Message {
    override fun serialize(stream: DataOutputStream) {
        synchronized(stream) {
            with(stream) {
                writeInt(3)
                writeInt(id)
                writeInt(data.size)
                write(data)
                flush()
            }
        }
    }

    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (javaClass != other?.javaClass) return false

        other as UHidMessage

        if (id != other.id) return false
        if (!data.contentEquals(other.data)) return false

        return true
    }

    override fun hashCode(): Int {
        var result = id
        result = 31 * result + data.contentHashCode()
        return result
    }
}