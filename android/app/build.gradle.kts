plugins {
    id("com.android.application")
}

android {
    namespace = "com.toxinhub.roster"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.toxinhub.roster"
        minSdk = 24
        targetSdk = 36
        versionCode = 5
        versionName = "1.4"
    }

    signingConfigs {
        create("release") {
            val p = System.getenv("ANDROID_KEYSTORE_PATH")
            if (!p.isNullOrBlank()) {
                storeFile = file(p)
                storePassword = System.getenv("ANDROID_KEYSTORE_PASSWORD")
                keyAlias = System.getenv("ANDROID_KEY_ALIAS")
                keyPassword = System.getenv("ANDROID_KEY_PASSWORD")
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            signingConfig = signingConfigs.getByName("release")
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

dependencies {
    implementation("androidx.activity:activity:1.10.1")
    implementation("androidx.core:core:1.16.0")
    implementation("androidx.webkit:webkit:1.17.0")
    implementation("androidx.swiperefreshlayout:swiperefreshlayout:1.1.0")
    implementation("androidx.work:work-runtime:2.10.1")
}
