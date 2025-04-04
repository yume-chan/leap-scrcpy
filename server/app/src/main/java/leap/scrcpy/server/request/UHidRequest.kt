package leap.scrcpy.server.request

import android.os.HandlerThread
import android.os.MessageQueue
import android.system.Os
import android.system.OsConstants
import androidx.collection.ArrayMap
import leap.scrcpy.server.Request
import leap.scrcpy.server.RequestFactory
import leap.scrcpy.server.messages.UHidMessage
import java.io.DataInputStream
import java.io.DataOutputStream
import java.io.FileDescriptor

data class UHidRequest(val operation: Int, val id: Int, val data: ByteArray) : Request {
    companion object : RequestFactory<UHidRequest> {
        val fds = ArrayMap<Int, FileDescriptor>()
        val queue = HandlerThread("uhid").apply { start() }.looper.queue

        override fun deserialize(stream: DataInputStream): UHidRequest {
            with(stream) {
                val operation = readInt()
                val id = readInt()
                val length = readInt()
                val data = ByteArray(length)
                readFully(data)
                return UHidRequest(operation, id, data)
            }
        }
    }

    override fun run(output: DataOutputStream) {
        when (operation) {
            0 -> {
                synchronized(fds) {
                    if (fds.containsKey(id)) {
                        throw IllegalArgumentException("Can't add UHID device: $id already exists")
                    }

                    val fd = Os.open("/dev/uhid", OsConstants.O_RDWR, 0)
                    fds[id] = fd
                    Os.write(fd, data, 0, data.size)

                    val buffer = ByteArray(4380)
                    queue.addOnFileDescriptorEventListener(
                        fd,
                        MessageQueue.OnFileDescriptorEventListener.EVENT_INPUT,
                    ) { _, _ ->
                        Os.read(fd, buffer, 0, buffer.size)
                        UHidMessage(id, buffer).serialize(output)
                        return@addOnFileDescriptorEventListener 0
                    }
                }
            }

            1 -> {
                val fd = fds[id]
                    ?: throw IllegalArgumentException("Can't send UHID request: $id doesn't exist")
                Os.write(fd, data, 0, data.size)
            }
        }
    }

    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (javaClass != other?.javaClass) return false

        other as UHidRequest

        if (operation != other.operation) return false
        if (id != other.id) return false
        if (!data.contentEquals(other.data)) return false

        return true
    }

    override fun hashCode(): Int {
        var result = operation
        result = 31 * result + id
        result = 31 * result + data.contentHashCode()
        return result
    }

}