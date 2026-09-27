plugins {
    id("com.android.application")
}

android {
    namespace = "com.toxinhub.roster"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.toxinhub.roster"
        minSdk = 23
        targetSdk = 36
        versionCode = 1
        versionName = "1.0"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}
