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
        versionCode = 2
        versionName = "1.1"
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

dependencies {
    implementation("androidx.webkit:webkit:1.17.0")
}
