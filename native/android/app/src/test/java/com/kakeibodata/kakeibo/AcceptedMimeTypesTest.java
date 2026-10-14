package com.kakeibodata.kakeibo;

import org.junit.Test;

import static org.junit.Assert.assertArrayEquals;

public final class AcceptedMimeTypesTest {
    @Test
    public void mapsExtensionsAndDeduplicatesSafeMimeTypes() {
        assertArrayEquals(new String[]{"text/plain", "image/jpeg"},
                AcceptedMimeTypes.fromAcceptTypes(new String[]{".txt,text/plain", ".jpg", "image/jpeg"}));
    }

    @Test
    public void rejectsExtensionsThatCannotBeMappedAndArbitraryMimeTypes() {
        assertArrayEquals(new String[]{"image/png"},
                AcceptedMimeTypes.fromAcceptTypes(new String[]{".txt.exe", "application/octet-stream", ".png"}));
    }
}
