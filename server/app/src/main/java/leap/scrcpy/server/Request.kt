package leap.scrcpy.server

import java.io.DataOutputStream

interface Request {
    fun run(output: DataOutputStream)
}