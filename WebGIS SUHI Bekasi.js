// ---------------------------------------------------------------------
// 1. PARAMETER (ubah di sini saja)
// ---------------------------------------------------------------------
var bekasiFc = ee.FeatureCollection('projects/ee-briliant2709/assets/Bekasi');
var bekasi = bekasiFc.geometry();

var KEC_ASSET = null;
var KEC_NAME_FIELD = null;
var KEC_FIELD_CANDIDATES = ['WADMKC', 'KECAMATAN', 'Kecamatan', 'kecamatan', 'NAMA_KEC', 'Nama_Kec',
  'NAMKEC', 'nama_kec', 'nm_kec', 'KEC', 'NAME_3'];

var START_YEAR = 2019;
var END_YEAR = 2025;
var START_MONTH = 6;   // jendela musim kemarau (sama tiap tahun)
var END_MONTH = 9;
var MAX_CLOUD = 60;

var NDBI_URBAN_MIN = -0.1;
var NDVI_URBAN_MAX = 0.3;
var NDVI_RURAL_MIN = 0.3;

var SCALE_STATS = 100;   // resolusi asli band termal
var N_SAMPLE = 1500;     // jumlah titik sampel untuk scatter plot
var SEED = 42;

var USE_ASSETS = false;
var ASSET_PREFIX = 'projects/ee-briliant2709/assets/SUHI_Bekasi_komposit_';

var PENYUSUN = 'Briliant Natasya Nivani — Kartografi dan Penginderaan Jauh';

var yearList = [];
for (var y = START_YEAR; y <= END_YEAR; y++) { yearList.push(y); }
var yearStr = yearList.map(String);

// ---------------------------------------------------------------------
// 2. KELAS INDEKS & LST
// ---------------------------------------------------------------------
var LEVEL5 = ['Sangat rendah', 'Rendah', 'Sedang', 'Tinggi', 'Sangat tinggi'];

var CLASS_DEF = {
  LST: {
    title: 'Land Surface Temperature (LST)', band: 'LST', unit: ' °C', dec: 1,
    about: 'LST (°C) = ST_B10 × 0,00341802 + 149,0 − 273,15 (produk Surface Temperature Landsat C2 L2).',
    breaks: [28, 32, 36, 40],
    names: LEVEL5,
    ranges: ['< 28 °C', '28 – 32 °C', '32 – 36 °C', '36 – 40 °C', '≥ 40 °C'],
    colors: ['#2c7bb6', '#abd9e9', '#ffffbf', '#fdae61', '#d7191c'],
    desc: [
      'Permukaan sangat sejuk: badan air, tambak, vegetasi sangat rapat.',
      'Sejuk: sawah tergenang, kebun campuran, vegetasi rapat.',
      'Sedang: lahan pertanian kering, permukiman bervegetasi.',
      'Panas: permukiman padat, jaringan jalan, lahan terbuka.',
      'Sangat panas: kawasan industri, atap logam/beton luas, lahan terbangun padat.'
    ]
  },
  NDVI: {
    title: 'NDVI — kerapatan vegetasi', band: 'NDVI', unit: '', dec: 3,
    about: 'NDVI = (NIR − Red) / (NIR + Red) = (B5 − B4) / (B5 + B4). Semakin tinggi, vegetasi semakin rapat/sehat.',
    breaks: [0.1, 0.2, 0.4, 0.6],
    names: LEVEL5,
    ranges: ['< 0,1', '0,1 – 0,2', '0,2 – 0,4', '0,4 – 0,6', '≥ 0,6'],
    colors: ['#a50026', '#f46d43', '#fee08b', '#a6d96a', '#1a9850'],
    desc: [
      'Non-vegetasi: badan air, lahan terbangun, lahan terbuka.',
      'Vegetasi sangat jarang: permukiman padat, lahan kosong berumput tipis.',
      'Vegetasi jarang–sedang: sawah fase awal/bera, tegalan, pekarangan.',
      'Vegetasi rapat: sawah fase vegetatif, kebun campuran.',
      'Vegetasi sangat rapat: tegakan pohon, hutan kota, sawah puncak vegetatif.'
    ]
  },
  NDBI: {
    title: 'NDBI — indeks lahan terbangun', band: 'NDBI', unit: '', dec: 3,
    about: 'NDBI = (SWIR1 − NIR) / (SWIR1 + NIR) = (B6 − B5) / (B6 + B5). Semakin tinggi, dominasi lahan terbangun semakin kuat.',
    breaks: [-0.2, -0.1, 0, 0.1],
    names: LEVEL5,
    ranges: ['< −0,2', '−0,2 – −0,1', '−0,1 – 0', '0 – 0,1', '≥ 0,1'],
    colors: ['#1a9850', '#d9ef8b', '#fee08b', '#f46d43', '#a50026'],
    desc: [
      'Bukan lahan terbangun: vegetasi rapat atau badan air.',
      'Dominan vegetasi/lahan basah dengan sedikit material bangunan.',
      'Peralihan: campuran vegetasi, bangunan, dan lahan terbuka.',
      'Lahan terbangun: permukiman dan jalan.',
      'Lahan terbangun padat: kawasan industri, pusat kegiatan, atap luas.'
    ]
  },
  MNDWI: {
    title: 'MNDWI — indeks kebasahan / badan air', band: 'MNDWI', unit: '', dec: 3,
    about: 'MNDWI = (Green − SWIR1) / (Green + SWIR1) = (B3 − B6) / (B3 + B6). Nilai > 0 umumnya menunjukkan air/genangan.',
    breaks: [-0.4, -0.2, 0, 0.2],
    names: LEVEL5,
    ranges: ['< −0,4', '−0,4 – −0,2', '−0,2 – 0', '0 – 0,2', '≥ 0,2'],
    colors: ['#8c510a', '#d8b365', '#f6e8c3', '#80cdc1', '#01665e'],
    desc: [
      'Sangat kering: lahan terbangun padat, lahan terbuka kering.',
      'Kering: vegetasi lahan kering, permukiman bervegetasi.',
      'Lembap: sawah, lahan basah, tanah lembap.',
      'Genangan/air dangkal: sawah tergenang, tambak dangkal.',
      'Badan air: sungai, situ, waduk, tambak, laut.'
    ]
  },
  SUHI: {
    title: 'Kelas SUHI (ΔLST terhadap rata-rata LST rural, area urban)', band: 'SUHI', unit: ' °C', dec: 1,
    about: 'SUHI (piksel) = LST − rata-rata LST rural tahun yang sama. Intensitas SUHI (wilayah) = rata-rata LST urban − rata-rata LST rural. Dikelaskan hanya pada piksel urban.',
    breaks: [0, 2, 4, 6], strict: true,
    names: ['Tidak ada SUHI', 'Lemah', 'Sedang', 'Kuat', 'Sangat kuat'],
    ranges: ['≤ 0 °C', '0 – 2 °C', '2 – 4 °C', '4 – 6 °C', '> 6 °C'],
    colors: ['#4575b4', '#fee090', '#fdae61', '#f46d43', '#a50026'],
    desc: [
      'Area urban tidak lebih panas dari rural (umumnya ada vegetasi/air di sekitarnya).',
      'Pulau panas lemah: permukiman bervegetasi.',
      'Pulau panas sedang: permukiman padat.',
      'Pulau panas kuat: permukiman sangat padat, kawasan komersial.',
      'Pulau panas sangat kuat: kawasan industri dan atap logam/beton luas.'
    ]
  }
};
var CLASS_KEYS = ['LST', 'SUHI', 'NDVI', 'NDBI', 'MNDWI'];

// ---------------------------------------------------------------------
// 3. TEKS INTERPRETASI (diisi setelah hasil keluar)
// ---------------------------------------------------------------------
var INTERPRETASI = {
  LST: 'Tuliskan interpretasi pola spasial dan temporal LST di sini, misalnya kecamatan dengan LST tertinggi, ' +
       'perubahan luas kelas panas, serta kaitannya dengan perkembangan kawasan industri dan permukiman.',
  SUHI: 'Tuliskan interpretasi intensitas dan distribusi SUHI di sini, misalnya tren intensitas 2019–2025, ' +
        'lokasi kelas SUHI kuat/sangat kuat, dan perubahan luas area urban.',
  INDEKS: 'Tuliskan interpretasi NDVI, NDBI, dan MNDWI di sini, misalnya alih fungsi sawah menjadi lahan terbangun ' +
          'dan perubahan badan air/tambak di wilayah pesisir.',
  REGRESI: 'Tuliskan interpretasi hasil regresi di sini, misalnya indeks mana yang paling kuat menjelaskan variasi LST ' +
           'dan konsistensinya antartahun.'
};

// ---------------------------------------------------------------------
// 4. PREPROCESSING & KOMPOSIT TAHUNAN (median)
// ---------------------------------------------------------------------
function prepL8(img) {
  img = img.select(['SR_B2', 'SR_B3', 'SR_B4', 'SR_B5', 'SR_B6', 'ST_B10',
                    'QA_PIXEL', 'QA_RADSAT']);
  var qa = img.select('QA_PIXEL');
  var radsat = img.select('QA_RADSAT');
  var mask = qa.bitwiseAnd(1 << 1).eq(0)   // dilated cloud
    .and(qa.bitwiseAnd(1 << 2).eq(0))      // cirrus
    .and(qa.bitwiseAnd(1 << 3).eq(0))      // cloud
    .and(qa.bitwiseAnd(1 << 4).eq(0))      // cloud shadow
    .and(radsat.eq(0));                    // tanpa saturasi

  var sr = img.select('SR_B.').multiply(0.0000275).add(-0.2);
  var lst = img.select('ST_B10')
    .multiply(0.00341802).add(149.0).subtract(273.15).rename('LST');
  var ndvi = sr.normalizedDifference(['SR_B5', 'SR_B4']).rename('NDVI');
  var ndbi = sr.normalizedDifference(['SR_B6', 'SR_B5']).rename('NDBI');
  var mndwi = sr.normalizedDifference(['SR_B3', 'SR_B6']).rename('MNDWI');

  return ee.Image.cat([lst, ndvi, ndbi, mndwi, sr.select(['SR_B4', 'SR_B3', 'SR_B2'])])
    .updateMask(mask)
    .copyProperties(img, ['system:time_start']);
}

function annualComposite(year) {
  var col = ee.ImageCollection('LANDSAT/LC08/C02/T1_L2')
    .filterBounds(bekasi)
    .filterDate(year + '-01-01', (year + 1) + '-01-01')
    .filter(ee.Filter.calendarRange(START_MONTH, END_MONTH, 'month'))
    .filter(ee.Filter.lt('CLOUD_COVER', MAX_CLOUD));
  return col.map(prepL8).median().clip(bekasi).set({
    'year': year,
    'n_scenes': col.size(),
    'system:time_start': ee.Date.fromYMD(year, 1, 1).millis()
  });
}

var compByYear = {};
yearList.forEach(function (yr) {
  compByYear[yr] = USE_ASSETS
    ? ee.Image(ASSET_PREFIX + yr).set('year', yr)
    : annualComposite(yr);
});
var composites = ee.ImageCollection(yearList.map(function (yr) { return compByYear[yr]; }));

// ---------------------------------------------------------------------
// 5. MASK URBAN & RURAL + SUHI
// ---------------------------------------------------------------------
function comp(yr) { return compByYear[yr]; }

function urbanMask(img) {
  var ndvi = img.select('NDVI'), ndbi = img.select('NDBI'), mndwi = img.select('MNDWI');
  return ndbi.gt(ndvi).and(ndbi.gte(NDBI_URBAN_MIN))
    .and(ndvi.lt(NDVI_URBAN_MAX)).and(mndwi.lt(0)).rename('URBAN');
}
function ruralMask(img) {
  return img.select('NDVI').gte(NDVI_RURAL_MIN)
    .and(img.select('MNDWI').lt(0))
    .and(urbanMask(img).not()).rename('RURAL');
}

var RURAL_REF = {};
var STATS = null;

function hasRef(yr) { return RURAL_REF[yr] !== undefined && RURAL_REF[yr] !== null; }
function suhiImg(yr) { return comp(yr).select('LST').subtract(RURAL_REF[yr]).rename('SUHI'); }

function classify(img, def) {
  var out = ee.Image(1);
  def.breaks.forEach(function (b, i) {
    out = out.where(def.strict ? img.gt(b) : img.gte(b), i + 2);
  });
  return out.updateMask(img.mask()).rename('kelas');
}
function classImage(key, yr) {
  var def = CLASS_DEF[key];
  var src = (key === 'SUHI')
    ? suhiImg(yr).updateMask(urbanMask(comp(yr)))
    : comp(yr).select(def.band);
  return classify(src, def);
}
function classIndex(v, def) {
  var k = 0;
  def.breaks.forEach(function (b) { if (def.strict ? v > b : v >= b) { k++; } });
  return k;
}

// ---------------------------------------------------------------------
// 6. DAFTAR LAYER PETA
// ---------------------------------------------------------------------
var visCont = {
  LST: {min: 25, max: 45, palette: CLASS_DEF.LST.colors},
  NDVI: {min: -0.2, max: 0.8, palette: CLASS_DEF.NDVI.colors},
  NDBI: {min: -0.5, max: 0.3, palette: CLASS_DEF.NDBI.colors},
  MNDWI: {min: -0.6, max: 0.6, palette: CLASS_DEF.MNDWI.colors},
  SUHI: {min: -2, max: 8, palette: ['#4575b4', '#ffffbf', '#fdae61', '#d73027', '#7f0000']}
};

var LAYERS = [
  {name: 'LST – kelas', kind: 'class', key: 'LST',
   info: 'Klasifikasi suhu permukaan menjadi 5 kelas (lihat tab Keterangan Kelas).'},
  {name: 'LST – kontinu (°C)', kind: 'cont', key: 'LST',
   info: 'Suhu permukaan median musim kemarau (Jun–Sep) dalam °C.'},
  {name: 'SUHI – kelas (area urban)', kind: 'class', key: 'SUHI', needRef: true,
   info: 'Kelas pulau panas pada piksel urban berdasarkan selisih LST terhadap rata-rata LST rural.'},
  {name: 'SUHI – intensitas ΔLST (°C)', kind: 'cont', key: 'SUHI', needRef: true,
   info: 'Selisih LST setiap piksel terhadap rata-rata LST rural tahun yang sama.'},
  {name: 'Area urban & rural', kind: 'ur',
   info: 'Hasil overlay NDVI, NDBI, dan MNDWI yang dipakai sebagai dasar perhitungan SUHI.'},
  {name: 'NDVI – kelas', kind: 'class', key: 'NDVI', info: 'Kelas kerapatan vegetasi.'},
  {name: 'NDVI – kontinu', kind: 'cont', key: 'NDVI', info: 'Nilai NDVI (−1 s.d. 1).'},
  {name: 'NDBI – kelas', kind: 'class', key: 'NDBI', info: 'Kelas kepadatan lahan terbangun.'},
  {name: 'NDBI – kontinu', kind: 'cont', key: 'NDBI', info: 'Nilai NDBI (−1 s.d. 1).'},
  {name: 'MNDWI – kelas', kind: 'class', key: 'MNDWI', info: 'Kelas kebasahan / badan air.'},
  {name: 'MNDWI – kontinu', kind: 'cont', key: 'MNDWI', info: 'Nilai MNDWI (−1 s.d. 1).'},
  {name: 'Citra true color (median)', kind: 'rgb',
   info: 'Komposit median warna asli (B4-B3-B2) sebagai acuan visual.'}
];
function layerIndex(name) {
  for (var i = 0; i < LAYERS.length; i++) { if (LAYERS[i].name === name) { return i; } }
  return 0;
}

function buildLayer(L, yr) {
  var c = comp(yr);
  if (L.kind === 'class') {
    return {image: classImage(L.key, yr), vis: {min: 1, max: 5, palette: CLASS_DEF[L.key].colors}};
  }
  if (L.kind === 'cont') {
    return {image: L.key === 'SUHI' ? suhiImg(yr) : c.select(L.key), vis: visCont[L.key]};
  }
  if (L.kind === 'ur') {
    var img = ee.Image(0).where(ruralMask(c), 1).where(urbanMask(c), 2).selfMask().clip(bekasi);
    return {image: img, vis: {min: 1, max: 2, palette: ['#1a9850', '#525252']}};
  }
  return {image: c.select(['SR_B4', 'SR_B3', 'SR_B2']), vis: {min: 0, max: 0.3, gamma: 1.2}};
}

// ---------------------------------------------------------------------
// 7. STATISTIK PER TAHUN
// ---------------------------------------------------------------------
function merge(a, b) {
  var o = {}, k;
  for (k in a) { o[k] = a[k]; }
  for (k in b) { o[k] = b[k]; }
  return o;
}
var REDUCE = {geometry: bekasi, scale: SCALE_STATS, maxPixels: 1e13, bestEffort: true, tileScale: 4};
function rr(img, reducer) { return img.reduceRegion(merge(REDUCE, {reducer: reducer})); }

var statsFc = ee.FeatureCollection(yearList.map(function (yr) {
  var img = comp(yr);
  var base = img.select(['LST', 'NDVI', 'NDBI', 'MNDWI']);
  var urban = urbanMask(img), rural = ruralMask(img);
  var area = function (m, name) {
    return rr(m.selfMask().multiply(ee.Image.pixelArea()).divide(1e6), ee.Reducer.sum()).get(name);
  };
  var pct = rr(base.select('LST'), ee.Reducer.percentile([5, 95]));
  return ee.Feature(null, rr(base, ee.Reducer.mean())).set({
    year: yr,
    n_scenes: img.get('n_scenes'),
    LST_p5: pct.get('LST_p5'),
    LST_p95: pct.get('LST_p95'),
    LST_std: rr(base.select('LST'), ee.Reducer.stdDev()).get('LST'),
    LST_urban: rr(base.select('LST').updateMask(urban), ee.Reducer.mean()).get('LST'),
    LST_rural: rr(base.select('LST').updateMask(rural), ee.Reducer.mean()).get('LST'),
    urban_km2: area(urban, 'URBAN'),
    rural_km2: area(rural, 'RURAL')
  });
}));

function regressDict(yr, x) {
  var img = comp(yr).select([x, 'LST']);
  var red = ee.Reducer.linearFit().combine({reducer2: ee.Reducer.pearsonsCorrelation(), sharedInputs: true});
  return ee.Dictionary(rr(img, red))
    .set('n', rr(img.select('LST'), ee.Reducer.count()).get('LST'))
    .set('year', yr).set('x', x);
}

// ---------------------------------------------------------------------
// 8. UI: style & fungsi bantu
// ---------------------------------------------------------------------
var C = {primary: '#b2182b', text: '#2b2b2b', muted: '#6b6b6b', border: '#f1c9bb'};

function fmt(v, d) {
  if (v === null || v === undefined || isNaN(v)) { return '–'; }
  return Number(v).toFixed(d === undefined ? 2 : d).replace('.', ',');
}
function signed(v, d) { return (v > 0 ? '+' : '') + fmt(v, d); }
function title(t) { return ui.Label(t, {fontSize: '16px', fontWeight: 'bold', color: C.primary, margin: '14px 10px 4px 10px'}); }
function subtitle(t) { return ui.Label(t, {fontSize: '13px', fontWeight: 'bold', color: C.text, margin: '12px 10px 2px 10px'}); }
function para(t) { return ui.Label(t, {fontSize: '12px', color: C.text, margin: '3px 10px', whiteSpace: 'pre-wrap'}); }
function note(t) { return ui.Label(t, {fontSize: '11px', color: C.muted, margin: '2px 10px', whiteSpace: 'pre-wrap'}); }
function loadingLabel(t) { return ui.Label('⏳ ' + (t || 'Memuat…'), {fontSize: '12px', color: C.muted, margin: '6px 10px'}); }
function card(ws) {
  return ui.Panel(ws, ui.Panel.Layout.flow('vertical'),
    {border: '1px solid ' + C.border, padding: '4px', margin: '6px 10px'});
}
function chip(color) {
  return ui.Label('', {backgroundColor: color, padding: '7px', margin: '2px 6px 2px 0', border: '1px solid #888'});
}
function kv(k, v) {
  return ui.Panel([
    ui.Label(k, {fontSize: '12px', color: C.muted, margin: '1px 6px', width: '160px'}),
    ui.Label(String(v), {fontSize: '12px', fontWeight: 'bold', margin: '1px 6px'})
  ], ui.Panel.Layout.flow('horizontal'));
}
function statOf(yr) {
  for (var i = 0; i < STATS.length; i++) { if (STATS[i].year === yr) { return STATS[i]; } }
  return null;
}
function extremeBy(key, wantMax) {
  var best = null;
  STATS.forEach(function (s) {
    if (s[key] === null || s[key] === undefined) { return; }
    if (!best || (wantMax ? s[key] > best[key] : s[key] < best[key])) { best = s; }
  });
  return best;
}
function lineChart(ttl, cols, vTitle, type) {
  var header = ['Tahun'].concat(cols.map(function (c) { return c.label; }));
  var rows = STATS.map(function (s) {
    return [String(s.year)].concat(cols.map(function (c) {
      var v = s[c.key];
      return (v === undefined || v === null) ? null : Number(Number(v).toFixed(4));
    }));
  });
  return ui.Chart([header].concat(rows), type || 'LineChart', {
    title: ttl, pointSize: 5, lineWidth: 2,
    hAxis: {title: 'Tahun'}, vAxis: {title: vTitle},
    colors: cols.map(function (c) { return c.color; }),
    legend: {position: cols.length > 1 ? 'bottom' : 'none'}
  });
}
function goBtn(label, layerName) {
  return ui.Button({label: label, style: {margin: '4px 10px'}, onClick: function () {
    state.layer = layerIndex(layerName);
    layerSelect.setValue(layerName, false);
    showTab('Peta');
    refresh();
  }});
}

// ---------------------------------------------------------------------
// 9. PETA, LEGENDA, INSPEKTOR KLIK
// ---------------------------------------------------------------------
var state = {year: START_YEAR, yearB: END_YEAR, layer: 0, opacity: 0.85,
             compare: false, showKec: true, kec: null, clipKec: false, clickPt: null, inspectYear: null, dataLayers: [], toggleBtns: []};

var kecFc = null;
var kecOutline = null;
var KEC_NAMES = [];
var bekasiOutline = bekasiFc.union(1).style({color: '000000', fillColor: '00000000', width: 2});
function kecGeom(name) { return kecFc.filter(ee.Filter.eq('nama', name)).geometry(); }

var mainMap = ui.Map(), leftMap = ui.Map(), rightMap = ui.Map();
[mainMap, leftMap, rightMap].forEach(function (m) {
  m.setOptions('HYBRID');
  m.setControlVisibility({layerList: true, zoomControl: true, mapTypeControl: true, fullscreenControl: true});
  m.style().set('cursor', 'crosshair');
  m.centerObject(bekasi, 10);
});
mainMap.style().set('stretch', 'both');
ui.Map.Linker([leftMap, rightMap]);
var split = ui.SplitPanel({firstPanel: leftMap, secondPanel: rightMap,
  orientation: 'horizontal', wipe: true, style: {stretch: 'both'}});

function makeLegend(L, yr) {
  var p = ui.Panel({style: {position: 'bottom-left', padding: '8px 10px', backgroundColor: 'rgba(255,255,255,0.92)'}});
  p.add(ui.Label(L.name + ' · ' + yr, {fontWeight: 'bold', fontSize: '13px', margin: '0 0 6px 0'}));
  if (L.kind === 'class') {
    var d = CLASS_DEF[L.key];
    d.names.forEach(function (n, i) {
      p.add(ui.Panel([chip(d.colors[i]),
        ui.Label(n + '  (' + d.ranges[i] + ')', {fontSize: '12px', margin: '3px 0'})],
        ui.Panel.Layout.flow('horizontal')));
    });
  } else if (L.kind === 'cont') {
    var v = visCont[L.key];
    p.add(ui.Thumbnail({
      image: ee.Image.pixelLonLat().select(0),
      params: {bbox: [0, 0, 1, 0.1], dimensions: '220x12', format: 'png', min: 0, max: 1, palette: v.palette},
      style: {stretch: 'horizontal', margin: '0', maxHeight: '14px'}
    }));
    var u = CLASS_DEF[L.key].unit;
    p.add(ui.Panel([
      ui.Label(fmt(v.min, 1) + u, {fontSize: '11px', margin: '2px 0'}),
      ui.Label(fmt((v.min + v.max) / 2, 1) + u, {fontSize: '11px', margin: '2px 0', stretch: 'horizontal', textAlign: 'center'}),
      ui.Label(fmt(v.max, 1) + u, {fontSize: '11px', margin: '2px 0'})
    ], ui.Panel.Layout.flow('horizontal')));
  } else if (L.kind === 'ur') {
    p.add(ui.Panel([chip('#525252'), ui.Label('Urban (NDBI > NDVI, NDBI ≥ −0,1, NDVI < 0,3, MNDWI < 0)', {fontSize: '11px', margin: '3px 0', width: '230px'})], ui.Panel.Layout.flow('horizontal')));
    p.add(ui.Panel([chip('#1a9850'), ui.Label('Rural (NDVI ≥ 0,3, bukan air, bukan urban)', {fontSize: '11px', margin: '3px 0', width: '230px'})], ui.Panel.Layout.flow('horizontal')));
  } else {
    p.add(ui.Label('Komposit median B4-B3-B2', {fontSize: '11px', margin: '0'}));
  }
  return p;
}

function mapMessage(t) {
  return ui.Label(t, {position: 'top-center', fontSize: '13px', padding: '6px 10px', backgroundColor: 'rgba(255,255,255,0.95)'});
}

function clearMap(map) {
  var i, items = [];
  for (i = 0; i < map.layers().length(); i++) { items.push(map.layers().get(i)); }
  for (i = 0; i < map.widgets().length(); i++) { items.push(map.widgets().get(i)); }
  items.forEach(function (it) { if (it !== inspector) { map.remove(it); } });
}

function drawMap(map, yr, badge, withToggle) {
  var L = LAYERS[state.layer];
  clearMap(map);
  if (L.needRef && !hasRef(yr)) {
    map.add(mapMessage(STATS
      ? 'Tahun ' + yr + ': tidak ada piksel rural, SUHI tidak dapat dihitung.'
      : '⏳ Menghitung referensi LST rural untuk layer SUHI…'));
  } else {
    var lyr = buildLayer(L, yr);
    if (kecFc && state.kec && state.clipKec) { lyr.image = lyr.image.clip(kecGeom(state.kec)); }
    var layer = ui.Map.Layer(lyr.image, lyr.vis, L.name + ' ' + yr, true, state.opacity);
    map.layers().add(layer);
    state.dataLayers.push(layer);
  }
  map.addLayer(bekasiOutline, {}, 'Batas Kab. Bekasi');
  if (kecOutline && state.showKec) { map.addLayer(kecOutline, {}, 'Batas kecamatan'); }
  if (kecFc && state.kec) {
    map.addLayer(kecFc.filter(ee.Filter.eq('nama', state.kec))
      .style({color: 'FFFF00', fillColor: '00000000', width: 3}), {}, 'Kecamatan ' + state.kec);
  }
  map.add(makeLegend(L, yr));
  if (withToggle) {
    var tb = ui.Button({
      label: rightPanel.style().get('shown') ? 'Sembunyikan statistik ▶' : '◀ Statistik',
      onClick: toggleRight,
      style: {position: 'middle-right', margin: '0', padding: '0'}
    });
    state.toggleBtns.push(tb);
    map.add(tb);
  }
  if (badge) {
    map.add(ui.Label(badge, {position: 'top-center', fontWeight: 'bold', fontSize: '16px',
      padding: '4px 12px', backgroundColor: 'rgba(255,255,255,0.92)'}));
  }
}

var inspector = ui.Panel({style: {position: 'bottom-right', width: '320px', padding: '8px',
  backgroundColor: 'rgba(255,255,255,0.96)', shown: false}});
var markerLayer = null;
mainMap.add(inspector);

function valueRow(key, val) {
  var d = CLASS_DEF[key];
  var idx = classIndex(val, d);
  return ui.Panel([chip(d.colors[idx]),
    ui.Label(key + ': ' + fmt(val, d.dec) + d.unit + '  →  ' + d.names[idx], {fontSize: '12px', margin: '3px 0'})],
    ui.Panel.Layout.flow('horizontal'));
}

function inspect(lon, lat) {
  var yr = state.year;
  state.inspectYear = yr;
  inspector.clear();
  inspector.style().set('shown', true);
  var closeBtn = ui.Button({label: '✕', style: {margin: '0', padding: '0'}, onClick: function () {
    inspector.style().set('shown', false);
    state.clickPt = null;
    if (markerLayer) { mainMap.layers().remove(markerLayer); markerLayer = null; }
  }});
  inspector.add(ui.Panel([
    ui.Label('Nilai piksel · ' + yr, {fontWeight: 'bold', fontSize: '13px', margin: '6px 0', stretch: 'horizontal'}),
    closeBtn], ui.Panel.Layout.flow('horizontal')));
  inspector.add(ui.Label('Lat ' + lat.toFixed(5) + ', Lon ' + lon.toFixed(5), {fontSize: '11px', color: C.muted, margin: '0 0 4px 0'}));
  var kecRow = ui.Panel();
  inspector.add(kecRow);
  var body = ui.Panel([loadingLabel('Membaca nilai…')]);
  inspector.add(body);

  var pt = ee.Geometry.Point([lon, lat]);
  if (kecFc) {
    kecFc.filterBounds(pt).aggregate_array('nama').evaluate(function (names) {
      if (!names || !names.length) { return; }
      var nm = String(names[0]);
      kecRow.add(ui.Panel([
        ui.Label('📍 Kecamatan ' + nm, {fontSize: '12px', fontWeight: 'bold', margin: '6px 0', stretch: 'horizontal'}),
        ui.Button({label: 'Fokus', style: {margin: '0', padding: '0'}, onClick: function () { focusKec(nm); }})
      ], ui.Panel.Layout.flow('horizontal')));
    });
  }
  var c = comp(yr);
  var img = c.select(['LST', 'NDVI', 'NDBI', 'MNDWI']).addBands(urbanMask(c)).addBands(ruralMask(c));
  if (hasRef(yr)) { img = img.addBands(suhiImg(yr)); }
  img.reduceRegion({reducer: ee.Reducer.first(), geometry: pt, scale: 30}).evaluate(function (v, err) {
    body.clear();
    if (err || !v || v.LST === null || v.LST === undefined) {
      body.add(ui.Label('Tidak ada data (di luar wilayah atau tertutup awan).', {fontSize: '12px'}));
      return;
    }
    ['LST', 'NDVI', 'NDBI', 'MNDWI'].forEach(function (k) {
      if (v[k] !== null && v[k] !== undefined) { body.add(valueRow(k, v[k])); }
    });
    var tipe = v.URBAN === 1 ? 'Urban' : (v.RURAL === 1 ? 'Rural (bervegetasi)' : 'Lainnya (air / campuran)');
    body.add(ui.Label('Tipe area: ' + tipe, {fontSize: '12px', fontWeight: 'bold', margin: '4px 0 0 0'}));
    if (v.SUHI !== undefined && v.SUHI !== null) {
      var kelas = v.URBAN === 1
        ? CLASS_DEF.SUHI.names[classIndex(v.SUHI, CLASS_DEF.SUHI)]
        : 'tidak dikelaskan (bukan urban)';
      body.add(ui.Label('ΔLST terhadap rural: ' + signed(v.SUHI, 1) + ' °C → ' + kelas, {fontSize: '12px', margin: '2px 0'}));
    }
  });

  inspector.add(ui.Chart.image.series({
    imageCollection: composites.select('LST'), region: pt,
    reducer: ee.Reducer.mean(), scale: 30, xProperty: 'year'
  }).setOptions({
    title: 'LST di titik ini ' + START_YEAR + '–' + END_YEAR, height: 170,
    hAxis: {format: '####'}, vAxis: {title: '°C'},
    legend: {position: 'none'}, pointSize: 4, colors: ['#d7191c']
  }));
}

mainMap.onClick(function (c) {
  state.clickPt = [c.lon, c.lat];
  if (markerLayer) { mainMap.layers().remove(markerLayer); }
  markerLayer = ui.Map.Layer(ee.Geometry.Point(state.clickPt), {color: '00FFFF'}, 'Titik klik');
  mainMap.layers().add(markerLayer);
  inspect(c.lon, c.lat);
});

function refresh() {
  state.dataLayers = [];
  state.toggleBtns = [];
  layerInfo.setValue(LAYERS[state.layer].info);
  if (state.compare) {
    drawMap(leftMap, state.year, '◀ ' + state.year, false);
    drawMap(rightMap, state.yearB, state.yearB + ' ▶', true);
  } else {
    drawMap(mainMap, state.year, null, true);
    if (state.clickPt) {
      markerLayer = ui.Map.Layer(ee.Geometry.Point(state.clickPt), {color: '00FFFF'}, 'Titik klik');
      mainMap.layers().add(markerLayer);
    }
    if (state.clickPt && state.inspectYear !== state.year) { inspect(state.clickPt[0], state.clickPt[1]); }
  }
  updateSummary();
}

// ---------------------------------------------------------------------
// 10. PANEL KIRI: header & tab
// ---------------------------------------------------------------------
var statusLabel = ui.Label('⏳ Menghitung statistik wilayah…',
  {fontSize: '11px', color: '#ffe0d6', backgroundColor: C.primary, margin: '4px 0 0 0'});
var header = ui.Panel([
  ui.Label('WebGIS Surface Urban Heat Island', {fontSize: '20px', fontWeight: 'bold', color: 'white', backgroundColor: C.primary, margin: '0'}),
  ui.Label('Kabupaten Bekasi · Landsat 8 OLI/TIRS C2 L2 · ' + START_YEAR + '–' + END_YEAR,
    {fontSize: '12px', color: 'white', backgroundColor: C.primary, margin: '4px 0 0 0'}),
  statusLabel
], ui.Panel.Layout.flow('vertical'), {backgroundColor: C.primary, padding: '12px'});

var PANEL_MIN = 260, PANEL_MAX = 720;
var leftW = 400, rightW = 340;

function setLeftW(w) {
  leftW = Math.max(PANEL_MIN, Math.min(PANEL_MAX, w));
  side.style().set('width', leftW + 'px');
}
function setRightW(w) {
  rightW = Math.max(PANEL_MIN, Math.min(PANEL_MAX, w));
  rightPanel.style().set('width', rightW + 'px');
}
function resizeRow(sliderValue, onSlide, closeLabel, onClose) {
  return ui.Panel([
    ui.Label('↔ Lebar', {fontSize: '11px', color: 'white', backgroundColor: C.primary, margin: '8px 4px 0 0'}),
    ui.Slider({min: PANEL_MIN, max: PANEL_MAX, step: 20, value: sliderValue, onChange: onSlide,
      style: {stretch: 'horizontal', backgroundColor: C.primary, margin: '0 4px'}}),
    ui.Button({label: closeLabel, onClick: onClose, style: {margin: '0', padding: '0'}})
  ], ui.Panel.Layout.flow('horizontal'), {backgroundColor: C.primary, margin: '6px 0 0 0'});
}

var leftStrip = ui.Panel([
  ui.Button({label: '»', onClick: function () { ui.root.widgets().set(0, side); }, style: {margin: '6px 2px', padding: '0'}}),
  ui.Label('Buka panel', {fontSize: '10px', color: C.muted, margin: '0 4px', whiteSpace: 'pre-wrap'})
], ui.Panel.Layout.flow('vertical'), {width: '56px', padding: '0'});
function collapseLeft() { ui.root.widgets().set(0, leftStrip); }

header.add(resizeRow(leftW, setLeftW, '« Tutup', collapseLeft));

var TAB_NAMES = ['Peta', 'Analisis', 'Keterangan Kelas', 'Metodologi'];
var currentTab = 'Peta';
var content = ui.Panel();
var tabButtons = TAB_NAMES.map(function (n) {
  return ui.Button({label: n, style: {margin: '2px', padding: '0'}, onClick: function () { showTab(n); }});
});
var tabBar = ui.Panel(tabButtons, ui.Panel.Layout.flow('horizontal', true), {margin: '6px 6px 0 6px'});

function showTab(n) {
  currentTab = n;
  tabButtons.forEach(function (b, i) {
    b.setLabel((TAB_NAMES[i] === n ? '● ' : '') + TAB_NAMES[i]);
  });
  content.clear();
  if (n === 'Peta') { content.add(mapTab); }
  if (n === 'Analisis') { content.add(analisisTab); showPage(pageSelect.getValue()); }
  if (n === 'Keterangan Kelas') { content.add(kelasTab); }
  if (n === 'Metodologi') { content.add(buildMetodologi()); }
}

// ---------------------------------------------------------------------
// 11. TAB PETA
// ---------------------------------------------------------------------
var yearSelect = ui.Select({items: yearStr, value: String(state.year), style: {stretch: 'horizontal'},
  onChange: function (v) { state.year = Number(v); refresh(); }});
function stepYear(d) {
  var i = yearList.indexOf(state.year) + d;
  if (i >= 0 && i < yearList.length) { yearSelect.setValue(String(yearList[i])); }
}
var layerSelect = ui.Select({items: LAYERS.map(function (l) { return l.name; }), value: LAYERS[0].name,
  style: {stretch: 'horizontal', margin: '4px 10px'},
  onChange: function (v) { state.layer = layerIndex(v); refresh(); }});
var layerInfo = note(LAYERS[0].info);
var opacitySlider = ui.Slider({min: 0, max: 1, step: 0.05, value: state.opacity, style: {stretch: 'horizontal', margin: '4px 10px'},
  onChange: function (v) {
    state.opacity = v;
    state.dataLayers.forEach(function (l) { l.setOpacity(v); });
  }});
var yearBSelect = ui.Select({items: yearStr, value: String(state.yearB),
  onChange: function (v) { state.yearB = Number(v); refresh(); }});
var yearBPanel = ui.Panel([ui.Label('Tahun kanan:', {fontSize: '12px', margin: '8px 6px 0 10px'}), yearBSelect],
  ui.Panel.Layout.flow('horizontal'), {shown: false});
var compareCheck = ui.Checkbox({label: 'Mode bandingkan 2 tahun (geser pembatas peta)', value: false,
  style: {margin: '8px 10px 0 10px'},
  onChange: function (v) {
    state.compare = v;
    yearBPanel.style().set('shown', v);
    ui.root.widgets().set(1, v ? split : mainMap);
    refresh();
  }});
var KEC_ALL = 'Semua kecamatan (Kab. Bekasi)';
var kecCheck = ui.Checkbox({label: 'Tampilkan batas kecamatan', value: true,
  style: {margin: '4px 10px', shown: false},
  onChange: function (v) { state.showKec = v; refresh(); }});
var kecClipCheck = ui.Checkbox({label: 'Tampilkan layer hanya di kecamatan terpilih', value: false,
  style: {margin: '4px 10px', shown: false},
  onChange: function (v) { state.clipKec = v; refresh(); }});
var kecSelect = ui.Select({items: [KEC_ALL], value: KEC_ALL, disabled: true,
  style: {stretch: 'horizontal', margin: '4px 10px'},
  onChange: function (v) {
    state.kec = (v === KEC_ALL) ? null : v;
    [mainMap, leftMap].forEach(function (m) {
      if (state.kec) { m.centerObject(kecGeom(state.kec)); } else { m.centerObject(bekasi, 10); }
    });
    refresh();
  }});
var kecStatus = note('⏳ Memuat daftar kecamatan…');
var kecSection = ui.Panel([subtitle('Kecamatan'), kecSelect, kecClipCheck, kecCheck, kecStatus]);
function focusKec(nm) {
  if (KEC_NAMES.indexOf(nm) >= 0) { showTab('Peta'); kecSelect.setValue(nm); }
}
var RP_BLUE = '#eaf3fb', RP_ORANGE = '#fff4e5', RP_GREEN = '#eef7ee', RP_GREY = '#f4f4f4';
var rightPanel = ui.Panel({style: {width: rightW + 'px', padding: '0', shown: true}});
var pieCache = {};

function rpLabel(t, bg, st) {
  return ui.Label(t, merge({fontSize: '12px', color: C.text, backgroundColor: bg,
    margin: '2px 4px', whiteSpace: 'pre-wrap'}, st || {}));
}
function rpSection(t, bg, widgets) {
  return ui.Panel([ui.Label(t, {fontWeight: 'bold', fontSize: '13px', color: C.primary,
      backgroundColor: bg, margin: '2px 4px 6px 4px'})].concat(widgets),
    ui.Panel.Layout.flow('vertical'),
    {backgroundColor: bg, border: '1px solid ' + C.border, padding: '6px', margin: '8px 8px 4px 8px'});
}
function rpRow(k, v, bg, color) {
  return ui.Panel([
    rpLabel(k, bg, {color: C.muted, width: '150px'}),
    rpLabel(v, bg, {fontWeight: 'bold', color: color || C.text})
  ], ui.Panel.Layout.flow('horizontal'), {backgroundColor: bg});
}

function toggleRight() {
  var shown = !rightPanel.style().get('shown');
  rightPanel.style().set('shown', shown);
  state.toggleBtns.forEach(function (b) { b.setLabel(shown ? 'Sembunyikan statistik ▶' : '◀ Statistik'); });
}

function rankText(key, yr) {
  var arr = STATS.filter(function (s) { return s[key] !== null && s[key] !== undefined; })
    .sort(function (a, b) { return b[key] - a[key]; });
  for (var i = 0; i < arr.length; i++) {
    if (arr[i].year === yr) { return 'ke-' + (i + 1) + ' tertinggi dari ' + arr.length + ' tahun'; }
  }
  return '–';
}

function readingGuide(L) {
  var t;
  if (L.kind === 'class') {
    var d = CLASS_DEF[L.key];
    t = '• Warna menunjukkan 5 kelas ' + L.key + ', dari "' + d.names[0] + '" (' + d.ranges[0] +
        ') hingga "' + d.names[4] + '" (' + d.ranges[4] + ').\n• ' + L.info +
        '\n• Arti tiap kelas ada di tab Keterangan Kelas.';
  } else if (L.kind === 'cont') {
    var v = visCont[L.key], u = CLASS_DEF[L.key].unit;
    t = '• Gradasi warna menunjukkan nilai ' + L.key + ' dari rendah (' + fmt(v.min, 1) + u +
        ') hingga tinggi (' + fmt(v.max, 1) + u + ').\n• ' + L.info;
  } else if (L.kind === 'ur') {
    t = '• Abu-abu = area urban, hijau = area rural (pembanding SUHI). Area tanpa warna adalah air atau lahan campuran.\n• ' + L.info;
  } else {
    t = '• ' + L.info + ' Gunakan untuk mencocokkan pola LST dengan objek nyata di lapangan.';
  }
  return t + '\n• Klik di peta untuk melihat nilai piksel dan grafik LST titik tersebut.';
}

function piePanel(key, yr) {
  var id = key + '_' + yr, d = CLASS_DEF[key];
  var p = ui.Panel();
  var draw = function (rows) {
    p.clear();
    var tot = 0;
    rows.forEach(function (r) { tot += r[1]; });
    p.add(ui.Chart([['Kelas', 'Luas (km²)']].concat(rows), 'PieChart', {
      title: 'Komposisi kelas ' + key + ' · ' + yr, colors: d.colors, pieHole: 0.4,
      legend: {position: 'right'}, height: 220, sliceVisibilityThreshold: 0}));
    p.add(note('Total ' + fmt(tot, 1) + ' km² piksel terklasifikasi.'));
  };
  if (pieCache[id]) { draw(pieCache[id]); return p; }
  p.add(loadingLabel('Menghitung komposisi kelas…'));
  ee.Image.pixelArea().divide(1e6).addBands(classImage(key, yr))
    .reduceRegion(merge(REDUCE, {reducer: ee.Reducer.sum().group({groupField: 1, groupName: 'kelas'})}))
    .get('groups')
    .evaluate(function (groups, err) {
      if (err) { p.clear(); p.add(note('Gagal menghitung: ' + err)); return; }
      var rows = d.names.map(function (n) { return [n, 0]; });
      (groups || []).forEach(function (g) { rows[g.kelas - 1][1] = Number(g.sum.toFixed(2)); });
      pieCache[id] = rows;
      draw(rows);
    });
  return p;
}

var RP_YELLOW = '#fffbe6';
var kecStatCache = {}, kecRankCache = {};

function kecStatsFeature(name, yr) {
  var g = kecGeom(name), img = comp(yr);
  var base = img.select(['LST', 'NDVI', 'NDBI', 'MNDWI']);
  var urban = urbanMask(img);
  var opt = merge(REDUCE, {geometry: g});
  var red = function (im, r) { return im.reduceRegion(merge(opt, {reducer: r})); };
  var pct = red(base.select('LST'), ee.Reducer.percentile([5, 95]));
  return ee.Feature(null, red(base, ee.Reducer.mean())).set({
    LST_std: red(base.select('LST'), ee.Reducer.stdDev()).get('LST'),
    LST_p5: pct.get('LST_p5'),
    LST_p95: pct.get('LST_p95'),
    LST_urban: red(base.select('LST').updateMask(urban), ee.Reducer.mean()).get('LST'),
    urban_km2: red(urban.selfMask().multiply(ee.Image.pixelArea()).divide(1e6), ee.Reducer.sum()).get('URBAN'),
    area_km2: g.area(1).divide(1e6)
  });
}

function kecRanking(yr, cb) {
  if (kecRankCache[yr]) { cb(kecRankCache[yr]); return; }
  comp(yr).select('LST').reduceRegions({collection: kecFc, reducer: ee.Reducer.mean(),
      scale: SCALE_STATS, tileScale: 4})
    .filter(ee.Filter.notNull(['mean'])).sort('mean', false)
    .reduceColumns(ee.Reducer.toList(2), ['nama', 'mean']).get('list')
    .evaluate(function (list, err) {
      if (err || !list) { cb(null); return; }
      kecRankCache[yr] = list;
      cb(list);
    });
}

function kecDetailPanel(name, yr, label) {
  var bg = RP_YELLOW;
  var holder = ui.Panel();
  var fill = function (s) {
    holder.clear();
    var suhi = (hasRef(yr) && s.LST_urban !== undefined && s.LST_urban !== null) ? s.LST_urban - RURAL_REF[yr] : null;
    var urbanPct = (s.urban_km2 && s.area_km2) ? s.urban_km2 / s.area_km2 * 100 : 0;
    var rankRow = rpRow('Peringkat LST', '⏳', bg);
    var rows = [
      rpLabel('SUHI kecamatan = LST rata-rata urban kecamatan − LST rata-rata rural kabupaten.', bg,
        {fontSize: '11px', color: C.muted}),
      rpRow('Luas kecamatan', fmt(s.area_km2, 1) + ' km²', bg),
      rpRow('LST rata-rata (μ)', fmt(s.LST) + ' °C', bg),
      rpRow('LST simpangan baku (σ)', fmt(s.LST_std) + ' °C', bg),
      rpRow('LST persentil 5 – 95', fmt(s.LST_p5, 1) + ' – ' + fmt(s.LST_p95, 1) + ' °C', bg),
      rpRow('LST rata-rata urban', fmt(s.LST_urban) + ' °C', bg),
      rpRow('Intensitas SUHI', suhi === null ? '–' : signed(suhi) + ' °C', bg, suhi > 0 ? C.primary : '#2166ac'),
      rpRow('Luas area urban', fmt(s.urban_km2 || 0, 1) + ' km² (' + fmt(urbanPct, 1) + '%)', bg)
    ];
    ['NDVI', 'NDBI', 'MNDWI'].forEach(function (k) {
      var d = CLASS_DEF[k];
      rows.push(rpRow(k, (s[k] === null || s[k] === undefined) ? '–' :
        fmt(s[k], 3) + '  (' + d.names[classIndex(s[k], d)] + ')', bg));
    });
    rows.push(rankRow);
    holder.add(rpSection(label + ' Kecamatan ' + name + ' — ' + yr, bg, rows));
    kecRanking(yr, function (list) {
      if (!list) { rankRow.widgets().get(1).setValue('–'); return; }
      for (var i = 0; i < list.length; i++) {
        if (String(list[i][0]) === name) {
          rankRow.widgets().get(1).setValue('ke-' + (i + 1) + ' terpanas dari ' + list.length + ' kecamatan');
        }
      }
    });
    holder.add(ui.Chart.image.series({
      imageCollection: composites.select('LST'), region: kecGeom(name),
      reducer: ee.Reducer.mean(), scale: SCALE_STATS, xProperty: 'year'
    }).setOptions({title: 'Tren LST rata-rata Kecamatan ' + name, height: 180,
      hAxis: {format: '####'}, vAxis: {title: '°C'}, legend: {position: 'none'},
      pointSize: 4, colors: ['#d7191c']}));
    holder.add(ui.Button({label: '↩ Kembali ke seluruh kabupaten', style: {margin: '4px 8px'},
      onClick: function () { kecSelect.setValue(KEC_ALL); }}));
  };
  var id = name + '_' + yr;
  if (kecStatCache[id]) { fill(kecStatCache[id]); return holder; }
  holder.add(loadingLabel('Menghitung statistik Kecamatan ' + name + '…'));
  kecStatsFeature(name, yr).evaluate(function (f, err) {
    if (err) { holder.clear(); holder.add(note('Gagal menghitung: ' + err)); return; }
    kecStatCache[id] = f.properties;
    fill(f.properties);
  });
  return holder;
}

function kecTopPanel(yr, label) {
  var bg = RP_YELLOW;
  var inner = ui.Panel([rpLabel('⏳ Menghitung peringkat kecamatan…', bg)],
    ui.Panel.Layout.flow('vertical'), {backgroundColor: bg});
  var sec = rpSection(label + ' Kecamatan Terpanas & Tersejuk — ' + yr, bg, [inner,
    rpLabel('Klik nama kecamatan untuk melihat detailnya, atau pilih di panel kiri.', bg,
      {fontSize: '11px', color: C.muted})]);
  kecRanking(yr, function (list) {
    inner.clear();
    if (!list) { inner.add(rpLabel('Gagal menghitung peringkat.', bg)); return; }
    var row = function (item, i) {
      return ui.Panel([
        rpLabel((i + 1) + '.', bg, {width: '24px'}),
        ui.Button({label: String(item[0]) + ' · ' + fmt(item[1], 1) + ' °C', style: {margin: '1px 0', padding: '0'},
          onClick: function () { focusKec(String(item[0])); }})
      ], ui.Panel.Layout.flow('horizontal'), {backgroundColor: bg});
    };
    inner.add(rpLabel('🔥 5 terpanas', bg, {fontWeight: 'bold'}));
    list.slice(0, 5).forEach(function (it, i) { inner.add(row(it, i)); });
    var start = Math.max(5, list.length - 3);
    if (start < list.length) {
      inner.add(rpLabel('🌿 Tersejuk', bg, {fontWeight: 'bold'}));
      list.slice(start).forEach(function (it, j) { inner.add(row(it, start + j)); });
    }
  });
  return sec;
}

function updateSummary() {
  rightPanel.clear();
  var L = LAYERS[state.layer], yr = state.year;
  var nums = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨'], n = 0;
  var num = function () { return nums[n++]; };

  rightPanel.add(ui.Panel([
    ui.Label('📊 Statistik Wilayah', {fontSize: '16px', fontWeight: 'bold', color: 'white',
      backgroundColor: C.primary, margin: '4px 0'}),
    resizeRow(rightW, setRightW, 'Tutup »', toggleRight)
  ], ui.Panel.Layout.flow('vertical'), {backgroundColor: C.primary, padding: '8px 12px'}));

  if (!STATS) { rightPanel.add(loadingLabel('Menghitung statistik wilayah…')); return; }
  var s = statOf(yr);

  rightPanel.add(rpSection(num() + ' Ringkasan LST & SUHI — ' + yr, RP_BLUE, [
    rpLabel('Komposit median Jun–Sep dari ' + s.n_scenes + ' scene Landsat 8. ' +
      'Intensitas SUHI = LST rata-rata urban − LST rata-rata rural.', RP_BLUE, {fontSize: '11px', color: C.muted}),
    rpRow('LST rata-rata (μ)', fmt(s.LST) + ' °C', RP_BLUE),
    rpRow('LST simpangan baku (σ)', fmt(s.LST_std) + ' °C', RP_BLUE),
    rpRow('LST persentil 5 – 95', fmt(s.LST_p5, 1) + ' – ' + fmt(s.LST_p95, 1) + ' °C', RP_BLUE),
    rpRow('LST rata-rata urban', fmt(s.LST_urban) + ' °C', RP_BLUE),
    rpRow('LST rata-rata rural', fmt(s.LST_rural) + ' °C', RP_BLUE),
    rpRow('Intensitas SUHI', signed(s.SUHI) + ' °C', RP_BLUE, s.SUHI > 0 ? C.primary : '#2166ac'),
    rpRow('Luas area urban', fmt(s.urban_km2, 1) + ' km²', RP_BLUE),
    rpRow('Peringkat LST', rankText('LST', yr), RP_BLUE),
    rpRow('Peringkat SUHI', rankText('SUHI', yr), RP_BLUE)
  ]));

  rightPanel.add(rpSection(num() + ' Rata-rata Indeks — ' + yr, RP_GREEN, ['NDVI', 'NDBI', 'MNDWI'].map(function (k) {
    var d = CLASS_DEF[k];
    return rpRow(k, fmt(s[k], 3) + '  (' + d.names[classIndex(s[k], d)] + ')', RP_GREEN);
  })));

  if (kecFc && state.kec) {
    rightPanel.add(kecDetailPanel(state.kec, yr, num()));
  } else if (kecFc) {
    rightPanel.add(kecTopPanel(yr, num()));
  }

  if (state.compare) {
    var b = statOf(state.yearB);
    var delta = function (k, dec, unit) {
      return fmt(s[k], dec) + ' → ' + fmt(b[k], dec) + unit + '  (' + signed(b[k] - s[k], dec) + ')';
    };
    rightPanel.add(rpSection(num() + ' Perbandingan ' + yr + ' → ' + state.yearB, RP_GREY, [
      rpRow('LST rata-rata', delta('LST', 2, ' °C'), RP_GREY),
      rpRow('Intensitas SUHI', delta('SUHI', 2, ' °C'), RP_GREY),
      rpRow('Luas urban', delta('urban_km2', 1, ' km²'), RP_GREY),
      rpRow('NDVI', delta('NDVI', 3, ''), RP_GREY),
      rpRow('NDBI', delta('NDBI', 3, ''), RP_GREY),
      rpRow('MNDWI', delta('MNDWI', 3, ''), RP_GREY)
    ]));
  }

  rightPanel.add(rpSection(num() + ' Cara Membaca Peta', RP_ORANGE, [rpLabel(readingGuide(L), RP_ORANGE)]));

  if (L.kind === 'class' && (!L.needRef || hasRef(yr))) {
    rightPanel.add(subtitle(num() + ' Komposisi Kelas ' + L.key + ' — ' + yr));
    rightPanel.add(piePanel(L.key, yr));
  }

  rightPanel.add(subtitle(num() + ' Tren LST Tahunan (' + START_YEAR + '–' + END_YEAR + ')'));
  rightPanel.add(note('Merah = persentil 95, oranye = rata-rata, biru = persentil 5.'));
  rightPanel.add(lineChart('LST per tahun (°C)', [
    {key: 'LST_p95', label: 'P95', color: '#d7191c'},
    {key: 'LST', label: 'Rata-rata', color: '#fdae61'},
    {key: 'LST_p5', label: 'P5', color: '#2c7bb6'}
  ], 'LST (°C)'));

  rightPanel.add(subtitle(num() + ' Intensitas SUHI per Tahun'));
  rightPanel.add(lineChart('LST urban − LST rural (°C)',
    [{key: 'SUHI', label: 'Intensitas SUHI', color: '#d73027'}], '°C', 'ColumnChart'));

  rightPanel.add(subtitle(num() + ' Luas Area Urban per Tahun'));
  rightPanel.add(lineChart('Luas area urban (km²)',
    [{key: 'urban_km2', label: 'Urban', color: '#525252'}], 'km²', 'ColumnChart'));
  rightPanel.add(note('Analisis lengkap (kelas, regresi) ada di tab Analisis pada panel kiri.'));
}

var mapTabWidgets = [
  card([
    para('Jelajahi suhu permukaan (LST), fenomena pulau panas perkotaan (SUHI), dan indeks tutupan lahan ' +
         'Kabupaten Bekasi per tahun (komposit median musim kemarau Juni–September).'),
    note('Cara pakai: pilih tahun dan layer → klik titik mana pun di peta untuk melihat nilai dan kelasnya → ' +
         'buka tab Analisis untuk grafik dan regresi.')
  ]),
  subtitle('Tahun'),
  ui.Panel([ui.Button('◀', function () { stepYear(-1); }), yearSelect, ui.Button('▶', function () { stepYear(1); })],
    ui.Panel.Layout.flow('horizontal'), {margin: '0 6px'}),
  subtitle('Layer'), layerSelect, layerInfo,
  subtitle('Transparansi layer'), opacitySlider,
  compareCheck, yearBPanel
];
mapTabWidgets.push(kecSection);
mapTabWidgets.push(note('Ringkasan statistik tahun terpilih tampil di panel kanan. Gunakan tombol "Statistik" ' +
  'di sisi kanan peta untuk menampilkan/menyembunyikannya. Statistik dihitung pada skala ' + SCALE_STATS +
  ' m untuk seluruh wilayah Kabupaten Bekasi.'));
var mapTab = ui.Panel(mapTabWidgets);

// ---------------------------------------------------------------------
// 12. TAB ANALISIS
// ---------------------------------------------------------------------
var PAGES = [
  '1. Land Surface Temperature (LST)',
  '2. Surface Urban Heat Island (SUHI)',
  '3. Indeks Tutupan Lahan (NDVI · NDBI · MNDWI)',
  '4. Hubungan LST – Indeks (Regresi)'
];
var pageCache = {};
var pageHolder = ui.Panel();
var pageSelect = ui.Select({items: PAGES, value: PAGES[0], style: {stretch: 'horizontal', margin: '8px 10px'},
  onChange: function (v) { showPage(v); }});
var analisisTab = ui.Panel([pageSelect, pageHolder]);

function showPage(name) {
  pageHolder.clear();
  if (!STATS) { pageHolder.add(loadingLabel('Statistik wilayah sedang dihitung, tunggu sebentar…')); return; }
  if (!pageCache[name]) { pageCache[name] = PAGE_BUILDERS[PAGES.indexOf(name)](); }
  pageHolder.add(pageCache[name]);
}

function classAreaPanel(key) {
  var p = ui.Panel([loadingLabel('Menghitung luas tiap kelas per tahun…')]);
  var d = CLASS_DEF[key];
  var years = yearList.filter(function (yr) { return key !== 'SUHI' || hasRef(yr); });
  var list = ee.List(years.map(function (yr) {
    return ee.Image.pixelArea().divide(1e6).addBands(classImage(key, yr))
      .reduceRegion(merge(REDUCE, {reducer: ee.Reducer.sum().group({groupField: 1, groupName: 'kelas'})}))
      .get('groups');
  }));
  list.evaluate(function (res, err) {
    p.clear();
    if (err) { p.add(note('Gagal menghitung: ' + err)); return; }
    var rows = res.map(function (groups, i) {
      var arr = [0, 0, 0, 0, 0];
      (groups || []).forEach(function (g) { arr[g.kelas - 1] = Number(g.sum.toFixed(2)); });
      return [String(years[i])].concat(arr);
    });
    var table = [['Tahun'].concat(d.names)].concat(rows);
    var opts = function (pct) {
      return {title: 'Luas kelas ' + key + ' per tahun' + (pct ? ' (%)' : ' (km²)'),
        isStacked: pct ? 'percent' : true, colors: d.colors,
        vAxis: {title: pct ? 'Persentase' : 'Luas (km²)'}, legend: {position: 'bottom'}};
    };
    var chart = ui.Chart(table, 'ColumnChart', opts(false));
    p.add(chart);
    p.add(ui.Checkbox({label: 'Tampilkan sebagai persentase', value: false, style: {margin: '0 10px'},
      onChange: function (v) { chart.setOptions(opts(v)); }}));

    var summ = function (r) {
      var tot = 0, mx = 1;
      for (var i = 1; i <= 5; i++) { tot += r[i]; if (r[i] > r[mx]) { mx = i; } }
      return {tot: tot, dom: d.names[mx - 1], domPct: tot ? r[mx] / tot * 100 : 0, top: r[5]};
    };
    if (rows.length) {
      var a = summ(rows[0]), b = summ(rows[rows.length - 1]);
      p.add(note('Kelas dominan ' + rows[0][0] + ': ' + a.dom + ' (' + fmt(a.domPct, 1) + '%); ' +
        rows[rows.length - 1][0] + ': ' + b.dom + ' (' + fmt(b.domPct, 1) + '%). ' +
        'Luas kelas "' + d.names[4] + '" berubah dari ' + fmt(a.top, 1) + ' km² menjadi ' + fmt(b.top, 1) + ' km².'));
    }
  });
  return p;
}

function kecPanel(key) {
  var holder = ui.Panel();
  var draw = function (yr) {
    holder.clear();
    if (key === 'SUHI' && !hasRef(yr)) { holder.add(note('SUHI tahun ini tidak tersedia.')); return; }
    var img = (key === 'SUHI' ? suhiImg(yr) : comp(yr).select(key)).rename('nilai');
    var fc = img.reduceRegions({collection: kecFc, reducer: ee.Reducer.mean(), scale: SCALE_STATS, tileScale: 4})
      .filter(ee.Filter.notNull(['mean'])).sort('mean', false);
    holder.add(ui.Chart.feature.byFeature(fc, 'nama', ['mean'])
      .setChartType('BarChart')
      .setOptions({title: 'Rata-rata ' + key + ' per kecamatan, ' + yr, height: 560,
        legend: {position: 'none'}, colors: ['#d7191c'], hAxis: {title: CLASS_DEF[key].unit || 'nilai'}}));
  };
  var sel = ui.Select({items: yearStr, value: String(END_YEAR), onChange: function (v) { draw(Number(v)); }});
  draw(END_YEAR);
  return ui.Panel([ui.Panel([ui.Label('Tahun:', {fontSize: '12px', margin: '8px 6px 0 10px'}), sel],
    ui.Panel.Layout.flow('horizontal')), holder]);
}

function pageLST() {
  var p = ui.Panel();
  var f = STATS[0], l = STATS[STATS.length - 1];
  var mx = extremeBy('LST', true), mn = extremeBy('LST', false);
  p.add(title('Analisis Land Surface Temperature'));
  p.add(card([
    para('Rata-rata LST musim kemarau berkisar ' + fmt(mn.LST) + ' °C (' + mn.year + ') hingga ' +
         fmt(mx.LST) + ' °C (' + mx.year + ').'),
    para('Perubahan ' + f.year + ' → ' + l.year + ': ' + signed(l.LST - f.LST) + ' °C.'),
    para('Rentang LST ' + l.year + ' (persentil 5–95): ' + fmt(l.LST_p5) + ' – ' + fmt(l.LST_p95) + ' °C.')
  ]));
  p.add(lineChart('LST per tahun (°C)', [
    {key: 'LST_p95', label: 'Persentil 95', color: '#d7191c'},
    {key: 'LST', label: 'Rata-rata', color: '#fdae61'},
    {key: 'LST_p5', label: 'Persentil 5', color: '#2c7bb6'}
  ], 'LST (°C)'));
  p.add(subtitle('Distribusi spasial klasifikasi LST'));
  p.add(classAreaPanel('LST'));
  if (kecFc) { p.add(subtitle('LST per kecamatan')); p.add(kecPanel('LST')); }
  p.add(subtitle('Interpretasi'));
  p.add(para(INTERPRETASI.LST));
  p.add(goBtn('🗺 Lihat peta kelas LST', 'LST – kelas'));
  p.add(goBtn('🗺 Lihat peta LST kontinu', 'LST – kontinu (°C)'));
  return p;
}

function pageSUHI() {
  var p = ui.Panel();
  var f = STATS[0], l = STATS[STATS.length - 1];
  var mx = extremeBy('SUHI', true), mn = extremeBy('SUHI', false);
  p.add(title('Analisis Surface Urban Heat Island'));
  p.add(note('Intensitas SUHI = rata-rata LST urban − rata-rata LST rural. Urban dan rural ditentukan dari overlay NDVI, NDBI, dan MNDWI.'));
  if (mx) {
    p.add(card([
      para('Intensitas SUHI tertinggi terjadi pada ' + mx.year + ' (' + signed(mx.SUHI) + ' °C), terendah pada ' +
           mn.year + ' (' + signed(mn.SUHI) + ' °C).'),
      para('Perubahan intensitas ' + f.year + ' → ' + l.year + ': ' + signed(l.SUHI - f.SUHI) + ' °C.'),
      para('Luas area urban: ' + fmt(f.urban_km2, 1) + ' km² (' + f.year + ') → ' + fmt(l.urban_km2, 1) +
           ' km² (' + l.year + '), selisih ' + signed(l.urban_km2 - f.urban_km2, 1) + ' km².')
    ]));
  }
  p.add(subtitle('Intensitas SUHI'));
  p.add(lineChart('Rata-rata LST area urban vs rural (°C)', [
    {key: 'LST_urban', label: 'Urban', color: '#a50026'},
    {key: 'LST_rural', label: 'Rural', color: '#1a9850'}
  ], 'LST (°C)'));
  p.add(lineChart('Intensitas SUHI (°C)', [{key: 'SUHI', label: 'Intensitas SUHI', color: '#d73027'}], '°C', 'ColumnChart'));
  p.add(lineChart('Luas area urban & rural (km²)', [
    {key: 'urban_km2', label: 'Urban', color: '#525252'},
    {key: 'rural_km2', label: 'Rural', color: '#1a9850'}
  ], 'km²', 'ColumnChart'));
  p.add(subtitle('Distribusi spasial kelas SUHI (area urban)'));
  p.add(classAreaPanel('SUHI'));
  if (kecFc) { p.add(subtitle('ΔLST rata-rata per kecamatan')); p.add(kecPanel('SUHI')); }
  p.add(subtitle('Interpretasi'));
  p.add(para(INTERPRETASI.SUHI));
  p.add(goBtn('🗺 Lihat peta kelas SUHI', 'SUHI – kelas (area urban)'));
  p.add(goBtn('🗺 Lihat peta intensitas SUHI', 'SUHI – intensitas ΔLST (°C)'));
  p.add(goBtn('🗺 Lihat peta area urban & rural', 'Area urban & rural'));
  return p;
}

function pageIndeks() {
  var p = ui.Panel();
  var f = STATS[0], l = STATS[STATS.length - 1];
  p.add(title('Analisis Indeks Tutupan Lahan'));
  p.add(card([
    para('NDVI: ' + fmt(f.NDVI, 3) + ' → ' + fmt(l.NDVI, 3) + ' (' + signed(l.NDVI - f.NDVI, 3) + ')'),
    para('NDBI: ' + fmt(f.NDBI, 3) + ' → ' + fmt(l.NDBI, 3) + ' (' + signed(l.NDBI - f.NDBI, 3) + ')'),
    para('MNDWI: ' + fmt(f.MNDWI, 3) + ' → ' + fmt(l.MNDWI, 3) + ' (' + signed(l.MNDWI - f.MNDWI, 3) + ')'),
    note('Perubahan rata-rata wilayah ' + f.year + ' → ' + l.year + '.')
  ]));
  p.add(lineChart('Rata-rata indeks per tahun', [
    {key: 'NDVI', label: 'NDVI', color: '#1a9850'},
    {key: 'NDBI', label: 'NDBI', color: '#a50026'},
    {key: 'MNDWI', label: 'MNDWI', color: '#01665e'}
  ], 'Nilai indeks'));
  ['NDVI', 'NDBI', 'MNDWI'].forEach(function (k) {
    p.add(subtitle(CLASS_DEF[k].title));
    p.add(note(CLASS_DEF[k].about));
    p.add(classAreaPanel(k));
    p.add(goBtn('🗺 Lihat peta kelas ' + k, k + ' – kelas'));
  });
  p.add(subtitle('Interpretasi'));
  p.add(para(INTERPRETASI.INDEKS));
  return p;
}

function strength(r) {
  var a = Math.abs(r);
  return a < 0.2 ? 'sangat lemah' : a < 0.4 ? 'lemah' : a < 0.6 ? 'sedang' : a < 0.8 ? 'kuat' : 'sangat kuat';
}
function pText(pv) {
  if (pv === null || pv === undefined) { return '–'; }
  return pv < 0.001 ? '< 0,001' : '= ' + fmt(pv, 3);
}
function equation(res, x) {
  return 'LST = ' + fmt(res.offset, 3) + (res.scale >= 0 ? ' + ' : ' − ') + fmt(Math.abs(res.scale), 3) + ' × ' + x;
}
function interpretReg(x, res) {
  var r = res.correlation, per = res.scale * 0.1;
  return 'Hubungan ' + (r > 0 ? 'positif' : 'negatif') + ' dengan kekuatan ' + strength(r) +
    '. Setiap kenaikan ' + x + ' sebesar 0,1, LST cenderung ' + (per > 0 ? 'naik' : 'turun') + ' sekitar ' +
    fmt(Math.abs(per), 2) + ' °C. ' + x + ' menjelaskan ' + fmt(r * r * 100, 1) + '% variasi LST.';
}

function runRegression(yr, x, holder) {
  holder.clear();
  holder.add(loadingLabel('Menghitung regresi ' + x + ' – LST ' + yr + '…'));
  regressDict(yr, x).evaluate(function (res, err) {
    holder.clear();
    if (err) { holder.add(note('Gagal menghitung: ' + err)); return; }
    holder.add(card([
      ui.Label(equation(res, x), {fontWeight: 'bold', fontSize: '14px', margin: '4px 8px', color: C.primary}),
      para('r = ' + fmt(res.correlation, 3) + '   ·   R² = ' + fmt(res.correlation * res.correlation, 3) +
           '   ·   p ' + pText(res['p-value']) + '   ·   n = ' + res.n + ' piksel'),
      para(interpretReg(x, res))
    ]));
    var sample = comp(yr).select([x, 'LST']).sample({region: bekasi, scale: SCALE_STATS,
      numPixels: N_SAMPLE, seed: SEED, tileScale: 4, geometries: false});
    holder.add(ui.Chart.feature.byFeature(sample, x, ['LST'])
      .setChartType('ScatterChart')
      .setOptions({title: 'Scatter ' + x + ' vs LST, ' + yr,
        hAxis: {title: x}, vAxis: {title: 'LST (°C)'},
        pointSize: 2, dataOpacity: 0.5, colors: [CLASS_DEF[x].colors[4]],
        legend: {position: 'bottom'},
        trendlines: {0: {type: 'linear', color: '#000000', lineWidth: 2, showR2: true, visibleInLegend: true}}}));
    holder.add(note('Persamaan dan R² di kartu atas dihitung dari seluruh piksel (skala ' + SCALE_STATS +
      ' m). Garis tren grafik dihitung dari ±' + N_SAMPLE + ' sampel acak, sehingga R²-nya bisa sedikit berbeda.'));
  });
}

function pageRegresi() {
  var p = ui.Panel();
  p.add(title('Hubungan LST dengan Indeks Tutupan Lahan'));
  p.add(note('Model regresi linear sederhana: LST = a + b·X, dengan X = NDVI, NDBI, atau MNDWI. ' +
    'r = koefisien korelasi Pearson; R² = koefisien determinasi.'));
  var ySel = ui.Select({items: yearStr, value: String(END_YEAR)});
  var xSel = ui.Select({items: ['NDVI', 'NDBI', 'MNDWI'], value: 'NDVI'});
  var holder = ui.Panel();
  p.add(ui.Panel([ySel, xSel, ui.Button('Hitung', function () {
    runRegression(Number(ySel.getValue()), xSel.getValue(), holder);
  })], ui.Panel.Layout.flow('horizontal'), {margin: '4px 6px'}));
  p.add(holder);
  runRegression(END_YEAR, 'NDVI', holder);

  p.add(subtitle('Rekap regresi semua tahun'));
  var allHolder = ui.Panel();
  p.add(ui.Button({label: 'Hitung tabel regresi ' + START_YEAR + '–' + END_YEAR, style: {margin: '4px 10px'},
    onClick: function () {
      allHolder.clear();
      allHolder.add(loadingLabel('Menghitung ' + yearList.length * 3 + ' model regresi…'));
      var arr = [];
      yearList.forEach(function (yr) {
        ['NDVI', 'NDBI', 'MNDWI'].forEach(function (x) { arr.push(regressDict(yr, x)); });
      });
      ee.List(arr).evaluate(function (res, err) {
        allHolder.clear();
        if (err) { allHolder.add(note('Gagal menghitung: ' + err)); return; }
        var table = [['Tahun', 'Indeks', 'Persamaan', 'r', 'R²', 'Kekuatan']];
        var r2 = {};
        res.forEach(function (d) {
          table.push([String(d.year), d.x, equation(d, d.x), fmt(d.correlation, 3),
            fmt(d.correlation * d.correlation, 3), (d.correlation > 0 ? 'positif ' : 'negatif ') + strength(d.correlation)]);
          r2[d.year] = r2[d.year] || {};
          r2[d.year][d.x] = Number((d.correlation * d.correlation).toFixed(4));
        });
        allHolder.add(ui.Chart(table, 'Table', {pageSize: 21}));
        var lines = [['Tahun', 'NDVI', 'NDBI', 'MNDWI']];
        yearList.forEach(function (yr) { lines.push([String(yr), r2[yr].NDVI, r2[yr].NDBI, r2[yr].MNDWI]); });
        allHolder.add(ui.Chart(lines, 'LineChart', {title: 'R² regresi LST terhadap tiap indeks',
          pointSize: 5, colors: ['#1a9850', '#a50026', '#01665e'], vAxis: {title: 'R²', viewWindow: {min: 0, max: 1}},
          legend: {position: 'bottom'}}));
      });
    }}));
  p.add(allHolder);
  p.add(subtitle('Interpretasi'));
  p.add(para(INTERPRETASI.REGRESI));
  return p;
}

var PAGE_BUILDERS = [pageLST, pageSUHI, pageIndeks, pageRegresi];

// ---------------------------------------------------------------------
// 13. TAB KETERANGAN KELAS
// ---------------------------------------------------------------------
var kelasTab = (function () {
  var p = ui.Panel();
  p.add(title('Keterangan Kelas'));
  p.add(note('Ambang kelas dibuat tetap untuk semua tahun agar perbandingan antartahun konsisten.'));
  CLASS_KEYS.forEach(function (k) {
    var d = CLASS_DEF[k];
    p.add(subtitle(d.title));
    p.add(note(d.about));
    d.names.forEach(function (n, i) {
      p.add(ui.Panel([
        chip(d.colors[i]),
        ui.Panel([
          ui.Label(n + '  ·  ' + d.ranges[i], {fontSize: '12px', fontWeight: 'bold', margin: '0'}),
          ui.Label(d.desc[i], {fontSize: '11px', color: C.muted, margin: '0', whiteSpace: 'pre-wrap'})
        ], ui.Panel.Layout.flow('vertical'), {margin: '0', width: '320px'})
      ], ui.Panel.Layout.flow('horizontal'), {margin: '3px 10px'}));
    });
  });
  return p;
})();

// ---------------------------------------------------------------------
// 14. TAB METODOLOGI
// ---------------------------------------------------------------------
function buildMetodologi() {
  var p = ui.Panel();
  p.add(title('Data & Metodologi'));
  p.add(subtitle('Data'));
  p.add(para('• Landsat 8 OLI/TIRS Collection 2 Tier 1 Level 2 (LANDSAT/LC08/C02/T1_L2), ' + START_YEAR + '–' + END_YEAR + '.\n' +
    '• Jendela musim kemarau bulan ' + START_MONTH + '–' + END_MONTH + ' setiap tahun, CLOUD_COVER scene < ' + MAX_CLOUD + '%.\n' +
    '• Batas administrasi Kabupaten Bekasi.'));
  p.add(subtitle('Tahapan pengolahan'));
  p.add(para('1. Masking awan, bayangan awan, cirrus, dan piksel saturasi (QA_PIXEL, QA_RADSAT).\n' +
    '2. Konversi reflektansi permukaan (×0,0000275 − 0,2) dan suhu permukaan ke °C.\n' +
    '3. Perhitungan NDVI, NDBI, dan MNDWI.\n' +
    '4. Komposit median tahunan.\n' +
    '5. Penentuan urban dan rural dengan overlay indeks:\n' +
    '   Urban: NDBI > NDVI, NDBI ≥ ' + NDBI_URBAN_MIN + ', NDVI < ' + NDVI_URBAN_MAX + ', MNDWI < 0\n' +
    '   Rural: NDVI ≥ ' + NDVI_RURAL_MIN + ', MNDWI < 0, bukan urban\n' +
    '6. SUHI = LST − rata-rata LST rural; intensitas = LST̄ urban − LST̄ rural.\n' +
    '7. Klasifikasi 5 kelas dengan ambang tetap (tab Keterangan Kelas).\n' +
    '8. Regresi linear sederhana LST terhadap NDVI, NDBI, dan MNDWI pada skala ' + SCALE_STATS + ' m.'));
  p.add(subtitle('Jumlah scene per tahun'));
  if (STATS) {
    var t = [['Tahun', 'Jumlah scene']];
    STATS.forEach(function (s) { t.push([String(s.year), s.n_scenes]); });
    p.add(ui.Chart(t, 'Table', {}));
  } else {
    p.add(loadingLabel());
  }
  p.add(subtitle('Keterbatasan'));
  p.add(para('• Resolusi asli band termal 100 m (diresampling 30 m), sehingga detail objek kecil terbatas.\n' +
    '• Komposit median mewakili kondisi musim kemarau, bukan suhu harian.\n' +
    '• Definisi urban/rural berbasis indeks, bukan peta tutupan lahan resmi.'));
  p.add(subtitle('Penyusun'));
  p.add(para(PENYUSUN));
  return p;
}

// ---------------------------------------------------------------------
// 15. JALANKAN APP
// ---------------------------------------------------------------------
var side = ui.Panel([header, tabBar, content], ui.Panel.Layout.flow('vertical'), {width: leftW + 'px', padding: '0'});
ui.root.clear();
ui.root.setLayout(ui.Panel.Layout.flow('horizontal'));
ui.root.add(side);
ui.root.add(mainMap);
ui.root.add(rightPanel);
showTab('Peta');
refresh();

function setupKecamatan() {
  var src = KEC_ASSET ? ee.FeatureCollection(KEC_ASSET) : bekasiFc;
  src.first().propertyNames().evaluate(function (props, err) {
    if (err || !props) { kecStatus.setValue('⚠ Gagal membaca atribut batas wilayah: ' + err); return; }
    var field = KEC_NAME_FIELD;
    if (!field) {
      for (var i = 0; i < KEC_FIELD_CANDIDATES.length; i++) {
        if (props.indexOf(KEC_FIELD_CANDIDATES[i]) >= 0) { field = KEC_FIELD_CANDIDATES[i]; break; }
      }
    }
    if (!field || props.indexOf(field) < 0) {
      kecStatus.setValue('⚠ Kolom nama kecamatan tidak ditemukan. Kolom yang ada: ' +
        props.filter(function (p) { return p.indexOf('system:') !== 0; }).join(', ') +
        '. Isi KEC_NAME_FIELD di bagian parameter.');
      return;
    }
    src.aggregate_array(field).distinct().sort().evaluate(function (list, err2) {
      if (err2 || !list || list.length < 2) {
        kecStatus.setValue('⚠ Asset batas tidak berisi poligon per kecamatan. Isi KEC_ASSET dengan batas kecamatan.');
        return;
      }
      KEC_NAMES = list.map(String);
      kecFc = ee.FeatureCollection(ee.List(list).map(function (n) {
        var geom = src.filter(ee.Filter.eq(field, n)).union(1).first().geometry();
        return ee.Feature(geom, {nama: n});
      }));
      kecOutline = kecFc.style({color: '444444', fillColor: '00000000', width: 0.8});
      kecSelect.items().reset([KEC_ALL].concat(KEC_NAMES));
      kecSelect.setValue(KEC_ALL, false);
      kecSelect.setDisabled(false);
      kecClipCheck.style().set('shown', true);
      kecCheck.style().set('shown', true);
      kecStatus.setValue(KEC_NAMES.length + ' kecamatan terdeteksi (kolom "' + field + '").');
      pageCache = {};
      refresh();
      if (currentTab === 'Analisis') { showTab('Analisis'); }
    });
  });
}
setupKecamatan();

statsFc.evaluate(function (fc, err) {
  if (err) { statusLabel.setValue('⚠ Gagal menghitung statistik: ' + err); return; }
  STATS = fc.features.map(function (f) { return f.properties; })
    .sort(function (a, b) { return a.year - b.year; });
  STATS.forEach(function (s) {
    var ok = s.LST_rural !== undefined && s.LST_rural !== null;
    RURAL_REF[s.year] = ok ? s.LST_rural : null;
    s.SUHI = (ok && s.LST_urban !== undefined && s.LST_urban !== null) ? s.LST_urban - s.LST_rural : null;
  });
  statusLabel.setValue('✔ Data siap · klik peta untuk melihat nilai piksel');
  refresh();
  if (currentTab !== 'Peta') { showTab(currentTab); }
});

// ---------------------------------------------------------------------
// 16. EXPORT KOMPOSIT KE ASSET (aktifkan bila diperlukan)
// ---------------------------------------------------------------------
// yearList.forEach(function (yr) {
//   Export.image.toAsset({
//     image: annualComposite(yr).toFloat(),
//     description: 'SUHI_Bekasi_komposit_' + yr,
//     assetId: ASSET_PREFIX + yr,
//     region: bekasi,
//     scale: 30,
//     maxPixels: 1e13
//   });
// });
