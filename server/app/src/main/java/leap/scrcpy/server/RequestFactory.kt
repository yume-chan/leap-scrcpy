package leap.scrcpy.server

import java.io.DataInputStream

interface RequestFactory<T : Request> {
    fun deserialize(stream: DataInputStream): T
}
