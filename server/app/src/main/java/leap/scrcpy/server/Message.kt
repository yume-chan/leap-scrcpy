package leap.scrcpy.server

import java.io.DataOutputStream

interface Message {
    fun serialize(stream: DataOutputStream)
}