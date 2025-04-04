package leap.scrcpy.server

import android.app.ActivityManager
import android.content.AttributionSource
import android.content.IContentProvider
import android.content.ContentResolver
import android.content.Context
import android.content.ContextWrapper
import android.os.Binder
import android.os.Build
import androidx.annotation.RequiresApi
import org.joor.Reflect

class FakeContext : ContextWrapper(
    Reflect.onClass("android.app.ActivityThread").create().call("getSystemContext").get()
) {
    companion object {
        val instance by lazy { FakeContext() }

        val contentResolver by lazy {
            @Suppress("unused") object : ContentResolver(instance) {
                private val activityManagerService: Reflect =
                    Reflect.onClass(ActivityManager::class.java).call("getService");

                fun acquireProvider(c: Context?, name: String?): IContentProvider {
                    return activityManagerService.call(
                        "getContentProviderExternal", name, 0, Binder(), "*cmd*"
                    ).get("provider")
                }

                fun releaseProvider(icp: IContentProvider?): Boolean {
                    return false
                }

                fun acquireUnstableProvider(
                    c: Context?, name: String?
                ): IContentProvider? {
                    return null
                }

                fun releaseUnstableProvider(icp: IContentProvider?): Boolean {
                    return false
                }

                fun unstableProviderDied(icp: IContentProvider?) {
                }
            }
        }
    }

    override fun getPackageName(): String {
        return "com.android.shell"
    }

    override fun getOpPackageName(): String {
        return "com.android.shell"
    }

    override fun getSystemService(name: String): Any {
        when (name) {
            Context.CLIPBOARD_SERVICE -> {
                val service = super.getSystemService(name)
                Reflect.on(service).set("mContext", this)
                return service
            }

            else -> return super.getSystemService(name)
        }
    }

    @RequiresApi(Build.VERSION_CODES.S)
    override fun getAttributionSource(): AttributionSource {
        return AttributionSource.Builder(2000).setPackageName("shell").build()
    }

    override fun getContentResolver(): ContentResolver {
        return FakeContext.contentResolver
    }
}