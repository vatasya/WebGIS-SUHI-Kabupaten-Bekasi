# WebGIS SUHI Kabupaten Bekasi

![Logo](Logo_WebGIS_SUHI_Bekasi_putih.png)

Repository ini berisi script WebGIS untuk melihat kondisi Surface Urban Heat Island (SUHI) di Kabupaten Bekasi dari tahun 2019 sampai 2025. Pengolahan datanya saya lakukan di Google Earth Engine menggunakan citra Landsat 8 OLI/TIRS Collection 2 Level 2.

Link WebGIS: https://ee-briliant2709.projects.earthengine.app/view/webgis-suhi-kabupaten-bekasi

## Isi WebGIS

Di halaman peta, pengguna bisa memilih tahun dan layer yang ingin ditampilkan, yaitu LST, SUHI, area urban dan rural, NDVI, NDBI, MNDWI, serta citra true color. Peta juga bisa diklik untuk melihat nilai piksel dan kelasnya, nama kecamatan di titik tersebut, beserta grafik perubahan LST dari tahun ke tahun. Ada juga mode untuk membandingkan dua tahun secara berdampingan, dan pilihan untuk melihat satu kecamatan saja.

Panel statistik di sebelah kanan menampilkan ringkasan LST, intensitas SUHI, luas area urban, rata-rata indeks, dan daftar kecamatan dengan suhu tertinggi dan terendah. Kalau satu kecamatan dipilih, statistiknya akan menyesuaikan dengan kecamatan tersebut.

Bagian analisis dibagi menjadi empat:

1. Land Surface Temperature dan sebaran kelas LST
2. Surface Urban Heat Island, baik intensitas maupun sebarannya
3. Indeks tutupan lahan (NDVI, NDBI, MNDWI)
4. Hubungan LST dengan indeks tutupan lahan menggunakan regresi linear sederhana

## Data

- Landsat 8 OLI/TIRS Collection 2 Tier 1 Level 2 (`LANDSAT/LC08/C02/T1_L2`)
- Batas administrasi Kabupaten Bekasi

Citra yang dipakai hanya bulan Juni sampai September setiap tahunnya supaya kondisinya sama-sama musim kemarau, lalu dibuat komposit median per tahun.

## Metode

Awan, bayangan awan, cirrus, dan piksel jenuh dihilangkan terlebih dahulu menggunakan band `QA_PIXEL` dan `QA_RADSAT`. Setelah itu nilai reflektansi dan suhu permukaan dikonversi menggunakan faktor skala dari USGS, sehingga LST didapat dalam satuan °C.

Indeks yang digunakan:

- NDVI = (B5 − B4) / (B5 + B4)
- NDBI = (B6 − B5) / (B6 + B5)
- MNDWI = (B3 − B6) / (B3 + B6)

Area urban dan rural ditentukan dari gabungan ketiga indeks tersebut. Piksel dianggap urban jika NDBI > NDVI, NDBI ≥ −0,1, NDVI < 0,3, dan MNDWI < 0. Piksel dianggap rural jika NDVI ≥ 0,3, MNDWI < 0, dan tidak termasuk urban.

Intensitas SUHI dihitung dari selisih rata-rata LST urban dengan rata-rata LST rural. Untuk peta per piksel, nilai SUHI adalah LST dikurangi rata-rata LST rural pada tahun yang sama. Semua indeks dan LST dikelaskan menjadi lima kelas dengan ambang yang sama untuk setiap tahun supaya hasilnya bisa dibandingkan.

## File

- `WebGIS_SUHI_Bekasi_App.js` – script Earth Engine App
- `Logo_WebGIS_SUHI_Bekasi.png` dan `Logo_WebGIS_SUHI_Bekasi_putih.png` – logo WebGIS

## Cara pakai script

Buka [Earth Engine Code Editor](https://code.earthengine.google.com), buat script baru, lalu salin isi file `WebGIS_SUHI_Bekasi_App.js`. Ganti path asset batas wilayah di bagian parameter sesuai asset yang kamu punya, kemudian klik Run. Kalau ingin dipublikasikan, gunakan menu Apps lalu New App.

## Penyusun

Briliant Natasya Nivani
