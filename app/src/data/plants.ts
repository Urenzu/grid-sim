// [name, lon, lat, nameplate_capacity_mw]  — EIA Form 860 (2023)
// Capacity drives icon size via √(cap/maxCap) scaling.

export const NUCLEAR_PLANTS: [string, number, number, number][] = [
  ['Palo Verde',       -112.86, 33.39, 3937],
  ['Diablo Canyon',    -120.85, 35.21, 2256],
  ['South Texas',       -96.05, 28.80, 2708],
  ['Comanche Peak',     -97.79, 32.30, 2440],
  ['Wolf Creek',        -95.69, 38.24, 1200],
  ['Callaway',          -91.78, 38.77, 1236],
  ['Prairie Island',    -92.64, 44.62, 1100],
  ['Monticello',        -93.84, 45.33,  671],
  ['Point Beach',       -87.54, 44.28, 1028],
  ['Quad Cities',       -90.67, 41.71, 1819],
  ['Dresden',           -88.27, 41.39, 1826],
  ['Clinton',           -88.84, 40.16, 1078],
  ['Braidwood',         -88.23, 41.24, 2359],
  ['Byron',             -89.28, 42.07, 2347],
  ['LaSalle',           -89.10, 41.24, 2294],
  ['D.C. Cook',         -86.57, 41.97, 2268],
  ['Fermi 2',           -83.26, 41.96, 1122],
  ['Davis-Besse',       -83.09, 41.60,  894],
  ['Perry',             -81.15, 41.80, 1261],
  ['Beaver Valley',     -80.43, 40.62, 1824],
  ['Susquehanna',       -76.15, 41.09, 2524],
  ['Peach Bottom',      -76.27, 39.76, 2773],
  ['Limerick',          -75.58, 40.22, 2312],
  ['Salem/Hope Creek',  -75.54, 39.46, 3519],
  ['Calvert Cliffs',    -76.44, 38.44, 1756],
  ['North Anna',        -77.80, 38.06, 1892],
  ['Surry',             -76.70, 37.17, 1660],
  ['Catawba',           -81.07, 35.10, 2436],
  ['McGuire',           -80.95, 35.43, 2434],
  ['Shearon Harris',    -78.95, 35.63,  900],
  ['Oconee',            -82.90, 34.79, 2619],
  ['Vogtle',            -81.76, 33.14, 4415],
  ['Hatch',             -82.34, 31.93, 1769],
  ['Turkey Point',      -80.33, 25.43, 1632],
  ['St. Lucie',         -80.24, 27.34, 1772],
  ['Seabrook',          -70.85, 42.90, 1246],
  ['Millstone',         -72.17, 41.31, 2082],
  ['FitzPatrick',       -76.38, 43.52,  838],
  ['Nine Mile Point',   -76.41, 43.53, 1736],
  ['Ginna',             -77.31, 43.28,  582],
  ['Arkansas Nuclear',  -93.22, 35.31, 1694],
  ['Grand Gulf',        -91.05, 32.01, 1448],
  ['Waterford',         -90.47, 29.99, 1200],
  ['Browns Ferry',      -87.12, 34.70, 3294],
  ['Sequoyah',          -85.09, 35.23, 2442],
  ['Watts Bar',         -84.79, 35.60, 2317],
]

export const HYDRO_PLANTS: [string, number, number, number][] = [
  // Columbia River / Pacific NW
  ['Grand Coulee WA',       -118.98, 47.96, 6809],
  ['Chief Joseph WA',       -119.63, 47.98, 2620],
  ['John Day OR/WA',        -120.70, 45.71, 2160],
  ['The Dalles OR',         -121.14, 45.61, 2160],
  ['Rocky Reach WA',        -120.28, 47.37, 1287],
  ['Wanapum WA',            -119.99, 46.87, 1038],
  ['McNary OR/WA',          -119.30, 45.93,  980],
  ['Priest Rapids WA',      -119.91, 46.62,  956],
  ['Bonneville OR/WA',      -121.94, 45.64, 1093],
  ['Wells WA',              -119.68, 47.88,  840],
  ['Boundary WA',           -117.36, 48.97, 1025],
  ['Pelton-Round Butte OR', -121.24, 44.76,  440],
  // Idaho / Montana
  ['Dworshak ID',           -115.64, 46.52,  480],
  ['Hungry Horse MT',       -113.98, 48.35,  285],
  ['Libby MT',              -115.32, 48.39,  600],
  // California
  ['Shasta CA',             -122.42, 40.72,  710],
  ['Oroville CA',           -121.49, 39.54,  819],
  ['Castaic CA',            -118.62, 34.49, 1566],
  ['Helms CA',              -118.92, 37.00, 1212],
  ['Folsom CA',             -121.19, 38.70,  198],
  // Southwest
  ['Hoover NV/AZ',          -114.74, 36.02, 2080],
  ['Glen Canyon AZ',        -111.49, 36.94, 1320],
  ['Davis AZ/NV',           -114.57, 35.19,  255],
  ['Flaming Gorge UT/WY',   -109.42, 40.92,  152],
  // TVA / Southeast — pumped storage & run-of-river
  ['Raccoon Mountain TN',   -85.56,  34.99, 1530],
  ['Keowee SC',             -82.89,  34.85,  900],
  ['Wilson AL',             -87.63,  34.80,  660],
  ['Wheeler AL',            -87.36,  34.80,  356],
  ['Pickwick Landing TN',   -88.25,  35.07,  216],
  ['Kentucky Dam KY',       -88.27,  37.01,  160],
  ['Guntersville AL',       -86.32,  34.35,  110],
  // East / Mid-Atlantic
  ['Bath County VA',        -79.79,  38.22, 3003],
  ['Niagara NY',            -79.04,  43.12, 2525],
  ['Ludington MI',          -86.44,  43.95, 2172],
  ['R.Moses Massena NY',    -74.75,  44.97,  912],
  ['Smith Mountain VA',     -79.66,  37.08,  616],
  ['Conowingo MD',          -76.17,  39.66,  572],
  // Ozarks
  ['Bull Shoals AR',        -92.58,  36.38,  340],
  ['Table Rock MO',         -93.32,  36.57,  200],
  ['Bagnell Dam MO',        -92.61,  38.20,  200],
]

export const WIND_FARMS: [string, number, number, number][] = [
  // California
  ['Alta Wind CA',          -118.53, 34.93, 1548],
  ['Tehachapi CA',          -118.43, 35.14,  800],
  ['San Gorgonio CA',       -116.84, 33.91,  600],
  // Pacific Northwest
  ['Shepherds Flat OR',     -119.96, 45.67,  845],
  ['Stateline OR/WA',       -119.17, 45.86,  300],
  ['Wild Horse WA',         -120.15, 46.87,  343],
  ['Klondike OR',           -121.10, 45.56,  300],
  // Texas
  ['Roscoe TX',             -100.54, 32.45,  781],
  ['Horse Hollow TX',        -99.47, 32.14,  735],
  ['Capricorn Ridge TX',    -100.68, 31.62,  662],
  ['Panhandle TX',          -101.00, 35.75,  458],
  ['Hackberry TX',          -101.45, 35.52,  458],
  ['Buffalo Gap TX',         -99.80, 32.28,  523],
  ['Flat Top TX',            -98.37, 31.24,  550],
  ['Colorado Bend TX',       -98.85, 31.80,  200],
  ['Notrees TX',            -102.86, 31.79,  150],
  ['Wildorado TX',          -102.25, 35.18,  161],
  // Kansas
  ['Flat Ridge KS',          -97.82, 37.73,  470],
  ['Rush Creek CO',         -104.17, 38.60,  570],
  ['Post Rock KS',           -98.47, 39.00,  300],
  ['Smoky Hills KS',         -97.72, 38.72,  250],
  // Colorado
  ['Peetz Table CO',        -103.12, 40.73,  400],
  ['Cedar Creek CO',        -104.27, 40.05,  274],
  // Midwest / Great Lakes
  ['Fowler Ridge IN',        -87.34, 40.55,  750],
  ['Meadow Lake IN',         -87.14, 40.87,  800],
  ['Twin Groves IL',         -88.86, 40.88,  200],
  ['Grand Ridge IL',         -88.87, 41.22,  204],
  ['Glacial Lakes MN',       -96.50, 44.65,  200],
  // Dakotas
  ['Tatanka ND/SD',         -102.75, 45.62,  300],
  ['Courtenay ND',           -98.58, 47.32,  150],
  // Wyoming / Montana
  ['Medicine Bow WY',       -105.96, 41.90,  200],
  ['Judith Gap MT',         -109.76, 46.68,  135],
  // East
  ['Vineyard Wind MA',       -70.45, 41.40,  800],
  ['Maple Ridge NY',         -75.33, 43.72,  321],
  ['Beech Ridge WV',         -80.29, 38.20,  186],
  ['Criterion WV',           -79.22, 39.37,  186],
]

export const SOLAR_FARMS: [string, number, number, number][] = [
  // California
  ['Edwards Sanborn CA',    -117.84, 34.82, 1300],
  ['Mount Signal CA',       -115.63, 32.67,  794],
  ['Solar Star CA',         -118.58, 35.13,  579],
  ['Blythe CA',             -114.71, 33.76,  485],
  ['Desert Sunlight CA',    -115.45, 33.82,  550],
  ['Topaz CA',              -120.03, 35.33,  550],
  ['Eland CA',              -119.35, 35.63,  300],
  ['California Flats CA',   -120.53, 35.79,  280],
  ['Antelope Valley CA',    -118.14, 34.71,  266],
  ['Garland CA',            -119.87, 35.79,  260],
  ['Genesis CA',            -114.98, 33.65,  250],
  ['McCoy CA',              -114.60, 33.85,  250],
  ['Ivanpah CA',            -115.48, 35.55,  392],
  // Nevada
  ['Copper Mountain NV',    -114.98, 35.78,  816],
  ['Gemini NV',             -115.10, 36.56,  690],
  ['Silver State S. NV',    -115.00, 35.97,  200],
  // Arizona
  ['Agua Caliente AZ',      -113.35, 33.27,  290],
  ['AZ Sun AZ',             -113.60, 33.45,  290],
  ['Solana AZ',             -112.58, 33.02,  280],
  ['Mesquite AZ',           -113.73, 33.20,  150],
  // New Mexico
  ['Roadrunner NM',         -106.75, 33.85,  200],
  ['Roosevelt County NM',   -103.52, 33.79,  200],
  // Texas
  ['Permian Basin TX',      -101.80, 31.40,  500],
  ['Fighting Jays TX',       -97.60, 30.41,  250],
  ['Samson Solar TX',        -96.21, 33.57,  200],
  ['Wildhorse TX',          -100.45, 33.60,  200],
  // Southeast / Mid-Atlantic
  ['Dominion Belews NC',     -80.10, 36.22,  980],
  ['Spotsylvania VA',        -77.73, 38.05,  500],
  ['Babcock Ranch FL',       -81.55, 26.84,  875],
  ['FPL Manatee FL',         -81.72, 27.45,  300],
  ['Strata GA',              -84.00, 32.50,  200],
]

export const GAS_PLANTS: [string, number, number, number][] = [
  // California
  ['Moss Landing CA',        -121.79, 36.80, 2500],
  ['Long Beach Gen CA',      -118.19, 33.76, 2160],
  ['Haynes CA',              -118.08, 33.73, 1650],
  ['Mountainview CA',        -117.28, 34.06, 1054],
  ['Pastoria CA',            -119.10, 34.80,  750],
  ['Elk Hills CA',           -119.43, 35.37,  550],
  // Texas
  ['Midlothian TX',           -97.00, 32.50, 2080],
  ['Guadalupe TX',            -98.33, 29.78, 1050],
  ['Panda Temple TX',         -97.35, 31.12,  758],
  ['Magic Valley TX',         -97.70, 26.40,  750],
  // Florida
  ['FPL Martin FL',           -80.72, 27.10, 2500],
  ['Duke Hines FL',           -82.73, 27.88, 2000],
  ['FPL Cape Canaveral FL',   -80.61, 28.43, 1980],
  ['Duke Citrus FL',          -82.85, 28.65, 1660],
  ['FPL Port Everglades FL',  -80.12, 26.09, 1380],
  // Arizona
  ['Mesquite Power AZ',      -112.52, 33.25, 1250],
  ['Redhawk AZ',             -112.71, 32.95, 1040],
  ['Arlington Valley AZ',    -112.85, 33.55,  600],
  // Nevada
  ['Harry Allen NV',         -115.00, 36.55,  568],
  ['Clark NV',               -114.83, 36.12,  564],
  // Southeast
  ['McDonough GA',            -84.55, 33.88, 3500],
  ['Magnolia MS',             -89.77, 30.45,  838],
  // Midwest
  ['Midland Cogen MI',        -84.25, 43.62, 1548],
  ['Lincoln Generating IL',   -88.16, 41.35,  990],
  // New England
  ['Mystic MA',               -71.05, 42.38, 1700],
  ['Canal MA',                -70.56, 41.77,  500],
  ['Granite Ridge NH',        -71.50, 43.30,  745],
  // New York / New Jersey
  ['Ravenswood NY',           -73.95, 40.77, 2000],
  ['Cricket Valley NY',       -73.57, 41.54, 1100],
  ['Linden Cogen NJ',         -74.22, 40.64, 1050],
  // Mid-Atlantic
  ['Panda Liberty PA',        -75.69, 40.10,  829],
  ['Bethlehem PA',            -75.48, 40.67,  755],
]

export const COAL_PLANTS: [string, number, number, number][] = [
  // Appalachia / Mid-Atlantic
  ['John Amos WV',           -81.76, 38.78, 2930],
  ['Mountaineer WV',         -81.93, 39.22, 1300],
  ['Mitchell WV',            -80.84, 39.65, 1560],
  ['Harrison WV',            -80.35, 39.30, 1984],
  ['Pleasants WV',           -81.27, 39.40, 1300],
  // Southeast / TVA
  ['Cumberland TN',          -87.64, 36.38, 2470],
  ['Kingston TN',            -84.52, 35.88, 1456],
  ['Gallatin TN',            -86.43, 36.38,  971],
  ['Widows Creek AL',        -85.83, 34.88, 1978],
  ['Gorgas AL',              -87.21, 33.88,  671],
  ['Miller AL',              -86.95, 33.44, 2700],
  ['Scherer GA',             -83.61, 33.07, 3564],
  ['Bowen GA',               -85.07, 34.22, 3480],
  ['Wansley GA',             -84.73, 33.49, 1862],
  // Midwest
  ['Laramie River WY',      -104.54, 42.04, 1710],
  ['Colstrip MT',           -106.64, 45.89, 2094],
  ['Basin Electric ND',      -99.67, 46.23, 1400],
  ['Stanton ND',            -100.39, 47.32,  490],
  ['James River ND',         -97.18, 46.92,  215],
  ['Cardinal OH',            -80.54, 39.56, 1880],
  ['Conesville OH',          -81.89, 40.22, 1320],
  ['Sammis OH',              -80.63, 40.56, 2233],
  ['Killen OH',              -83.99, 38.77,  600],
  ['Clifty Creek IN',        -85.50, 38.59, 1303],
  ['Rockport IN',            -82.63, 37.87, 2600],
  ['Petersburg IN',          -87.27, 38.50, 1720],
  ['Gibson IN',              -87.60, 38.33, 3340],
  ['Wabash River IN',        -87.44, 39.72,  873],
  ['Schahfer IN',            -87.27, 41.35, 2080],
  ['Baldwin IL',             -89.82, 38.16, 1830],
  ['Newton IL',              -88.31, 38.96, 1209],
  ['Havana IL',              -90.00, 40.27,  469],
  ['Powerton IL',            -89.55, 40.61, 1538],
  ['Prairie State IL',       -89.49, 37.67, 1600],
  ['Cardinal IA',            -91.66, 41.50,  630],
  ['Ottumwa IA',             -92.42, 41.02,  726],
  // Southwest / Plains
  ['Navajo AZ',             -111.39, 36.81, 2250],
  ['Four Corners NM',       -108.48, 36.72, 1800],
  ['San Juan NM',           -108.17, 36.76, 1848],
  ['Tolk TX',               -102.59, 33.79, 1070],
  ['Oklaunion TX',           -99.00, 33.90,  780],
  ['Martin Lake TX',         -94.57, 31.84, 2250],
  ['Monticello TX',          -94.87, 33.09, 1880],
  ['Big Brown TX',           -96.07, 31.71, 1186],
  ['Limestone TX',           -96.37, 31.43, 1850],
  ['W.A. Parish TX',         -95.63, 29.37, 2540],
  // Appalachia South
  ['Roxboro NC',             -78.95, 36.45, 2558],
  ['Marshall NC',            -80.95, 35.56, 2092],
  ['Allen NC',               -80.94, 35.24,  287],
  // SWPP / Mid-continent
  ['Iatan MO',               -94.83, 39.27, 1300],
  ['Hawthorn MO',            -94.37, 39.07,  726],
  ['Labadie MO',             -90.96, 38.54, 2372],
  ['Thomas Hill MO',         -92.62, 39.60, 1201],
  ['Holcomb KS',            -100.97, 37.98,  360],
]

// Extra Voronoi seeds — nudge territory boundaries for large BAs
export const EXTRA_SEEDS: [string, [number, number]][] = [
  // BPAT — Oregon, Washington, northern Idaho, western Montana
  ['BPAT', [-123.0, 47.5]], ['BPAT', [-120.5, 47.5]], ['BPAT', [-120.5, 45.5]],
  ['BPAT', [-123.5, 44.5]], ['BPAT', [-116.5, 47.8]], ['BPAT', [-118.5, 46.5]],
  // MISO — North Dakota down to Louisiana
  ['MISO', [-100.5, 47.5]], ['MISO', [-97.0,  47.2]], ['MISO', [-97.0,  45.5]],
  ['MISO', [-94.2,  46.5]], ['MISO', [-90.0,  46.5]], ['MISO', [-83.5,  43.5]],
  ['MISO', [-85.5,  45.5]], ['MISO', [-84.0,  42.5]], ['MISO', [-89.5,  44.5]],
  ['MISO', [-91.5,  42.0]], ['MISO', [-89.0,  42.0]], ['MISO', [-87.0,  39.5]],
  ['MISO', [-89.5,  37.5]], ['MISO', [-91.0,  35.5]], ['MISO', [-89.5,  32.5]],
  ['MISO', [-91.5,  31.0]], ['MISO', [-90.5,  29.5]],
  // SWPP — Great Plains, Kansas to South Dakota
  ['SWPP', [-102.0, 43.0]], ['SWPP', [-100.0, 42.0]], ['SWPP', [-98.0,  41.0]],
  ['SWPP', [-99.0,  39.0]], ['SWPP', [-96.5,  37.0]], ['SWPP', [-97.5,  36.0]],
  ['SWPP', [-95.5,  35.0]], ['SWPP', [-99.0,  34.5]],
  // PJM — Ohio through Mid-Atlantic
  ['PJM',  [-84.0,  40.5]], ['PJM',  [-82.0,  40.0]], ['PJM',  [-81.0,  41.5]],
  ['PJM',  [-79.0,  41.5]], ['PJM',  [-76.5,  41.0]], ['PJM',  [-74.8,  40.5]],
  ['PJM',  [-76.5,  38.5]], ['PJM',  [-78.5,  37.5]], ['PJM',  [-81.0,  38.5]],
  // TVA — Tennessee Valley
  ['TVA',  [-89.5,  35.8]], ['TVA',  [-88.0,  34.8]], ['TVA',  [-83.0,  35.0]],
  // SOCO — Southern Company: Georgia, Alabama, Mississippi
  ['SOCO', [-88.5,  34.0]], ['SOCO', [-87.5,  33.0]], ['SOCO', [-85.5,  32.0]],
  ['SOCO', [-84.5,  32.5]], ['SOCO', [-83.5,  31.5]], ['SOCO', [-84.0,  30.5]],
  ['SOCO', [-88.0,  30.5]], ['SOCO', [-89.5,  31.5]],
  // DUK — Duke Energy Carolinas + midwest
  ['DUK',  [-79.0,  35.5]], ['DUK',  [-81.5,  36.5]],
  // CPLE — Duke Energy Progress East NC
  ['CPLE', [-76.5,  35.2]], ['CPLE', [-77.8,  34.2]],
  // SCEG — Dominion Energy SC
  ['SCEG', [-81.5,  33.5]], ['SCEG', [-80.5,  34.0]],
  // SC — Santee Cooper (coastal SC)
  ['SC',   [-79.5,  33.2]], ['SC',   [-80.5,  33.8]],
  // LGEE — Kentucky
  ['LGEE', [-84.5,  37.5]], ['LGEE', [-86.5,  37.0]],
  // AECI — Missouri Ozarks
  ['AECI', [-91.5,  37.5]], ['AECI', [-93.0,  36.5]],
  // Florida
  ['FPC',  [-82.0,  27.5]], ['FPC',  [-81.5,  27.0]],
  ['FMPP', [-81.0,  28.2]],
  // ISNE — New England
  ['ISNE', [-72.5,  41.8]], ['ISNE', [-71.2,  41.8]], ['ISNE', [-71.5,  42.5]],
  ['ISNE', [-73.0,  43.5]], ['ISNE', [-70.0,  43.8]], ['ISNE', [-68.5,  45.0]],
  // ERCO — Texas
  ['ERCO', [-95.0,  30.0]], ['ERCO', [-97.5,  30.5]], ['ERCO', [-96.0,  33.5]],
  ['ERCO', [-100.5, 32.0]], ['ERCO', [-102.5, 31.0]],
  // NYIS — New York
  ['NYIS', [-73.5,  41.5]], ['NYIS', [-74.5,  42.5]], ['NYIS', [-78.0,  43.0]],
  // NWMT — Montana
  ['NWMT', [-110.5, 47.0]], ['NWMT', [-111.5, 46.5]],
  // BANC — Northern California
  ['BANC', [-122.5, 40.5]], ['BANC', [-120.5, 41.0]],
]
