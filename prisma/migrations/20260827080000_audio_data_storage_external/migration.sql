-- Zvuk se ukládá už komprimovaný (mp3/m4a/ogg), takže výchozí Postgres
-- TOAST komprese (STORAGE EXTENDED) nic nešetří a navíc znemožňuje
-- levné částečné čtení: substring() by musel detoastovat (dekomprimovat)
-- celou hodnotu, i když si žádáme jen pár set kilobajtů z rozsahu.
-- STORAGE EXTERNAL ukládá hodnotu nekomprimovaně mimo řádek, takže
-- substring() čte jen požadovaný rozsah bajtů.
ALTER TABLE "AudioTrack" ALTER COLUMN "data" SET STORAGE EXTERNAL;
