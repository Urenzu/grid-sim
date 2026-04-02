import { useEffect, useRef } from 'react'
import * as d3 from 'd3'
import * as topojson from 'topojson-client'
import type { GridData, BaGenData, Mode, LayerKey } from '../types'

export const FUEL_COLORS: Record<string, string> = {
  nuclear: '#8b5cf6',
  wind:    '#0891b2',
  solar:   '#d97706',
  gas:     '#ea580c',
  coal:    '#dc2626',
  hydro:   '#2563eb',
  other:   '#6b7280',
}

export const BA_DEFS: [string, string, [number, number]][] = [
  // ── Western Interconnection ──────────────────────────────────────────────
  ['BPAT', 'Bonneville Power Admin',          [-122.5,  46.8]],
  ['PACW', 'PacifiCorp West',                 [-120.5,  44.2]],
  ['CISO', 'California ISO',                  [-119.5,  37.2]],
  ['IPCO', 'Idaho Power',                     [-114.8,  43.5]],
  ['NEVP', 'NV Energy',                       [-117.2,  39.3]],
  ['PACE', 'PacifiCorp East',                 [-111.5,  40.8]],
  ['AZPS', 'Arizona Public Service',          [-112.2,  33.6]],
  ['SRP',  'Salt River Project',              [-111.9,  33.4]],
  ['WACM', 'WAPA Colorado',                   [-108.5,  39.2]],
  ['PSCO', 'Xcel Energy Colorado',            [-104.8,  39.7]],
  ['AVA',  'Avista Corporation',              [-117.4,  47.7]],
  ['DOPD', 'Douglas County PUD',              [-120.3,  47.4]],
  ['GCPD', 'Grant County PUD',                [-119.6,  47.3]],
  ['CHPD', 'Chelan County PUD',               [-120.5,  47.5]],
  ['TPWR', 'City of Tacoma',                  [-122.4,  47.2]],
  ['NWMT', 'NorthWestern Energy MT',          [-112.5,  46.0]],
  ['GWA',  'NaturEner Wind Watch MT',         [-107.5,  48.0]],
  ['PNM',  'Public Service NM',               [-106.7,  35.1]],
  ['EPE',  'El Paso Electric',                [-106.5,  31.8]],
  ['TEPC', 'Tucson Electric Power',           [-110.9,  32.2]],
  ['IID',  'Imperial Irrigation District',    [-115.5,  33.1]],
  ['LDWP', 'LA Dept of Water & Power',        [-118.4,  34.0]],
  ['BANC', 'N. California Balancing Auth',    [-121.5,  40.5]],
  ['TIDC', 'Turlock Irrigation District',     [-120.8,  37.6]],
  ['WALC', 'WAPA Desert Southwest',           [-112.1,  33.8]],
  ['HGMA', 'Harquahala Generating',            [-113.5,  33.2]],
  ['DEAA', 'Arlington Valley LLC',            [-112.7,  33.0]],
  // ── Texas ────────────────────────────────────────────────────────────────
  ['ERCO', 'ERCOT',                           [ -99.3,  31.5]],
  // ── Eastern Interconnection ──────────────────────────────────────────────
  ['SPA',  'Southwestern Power Admin',         [ -95.5,  36.5]],
  ['WAUW', 'WAPA Upper Great Plains',         [-101.5,  45.5]],
  ['WWA',  'NaturEner Rim Rock MT',           [-108.3,  48.4]],
  ['SWPP', 'Southwest Power Pool',            [ -97.5,  38.5]],
  ['MISO', 'Midcontinent ISO',                [ -90.0,  42.5]],
  ['PJM',  'PJM Interconnection',             [ -79.5,  40.5]],
  ['TVA',  'Tennessee Valley Authority',      [ -87.0,  35.5]],
  ['SOCO', 'Southern Company',                [ -86.5,  32.4]],
  ['LGEE', 'LG&E and KU Energy',             [ -85.7,  38.2]],
  ['OVEC', 'Ohio Valley Electric Corp',       [ -82.2,  38.8]],
  ['AECI', 'Associated Electric Coop',        [ -92.0,  37.0]],
  ['EDE',  'Empire District Electric',        [ -94.5,  37.1]],
  ['DUK',  'Duke Energy',                     [ -80.8,  35.4]],
  ['CPLE', 'Duke Energy Progress East',       [ -77.5,  35.8]],
  ['CPLW', 'Duke Energy Progress West',       [ -80.5,  35.2]],
  ['SCEG', 'Dominion Energy SC',              [ -81.0,  34.0]],
  ['SC',   'Santee Cooper',                   [ -79.9,  33.4]],
  ['SEPA', 'Southeastern Power Admin',        [ -83.8,  33.6]],
  ['FPL',  'Florida Power & Light',           [ -80.8,  27.5]],
  ['FPC',  'Duke Energy Florida',             [ -82.5,  28.1]],
  ['FMPP', 'FL Municipal Power Pool',         [ -81.5,  28.7]],
  ['JEA',  'Jacksonville Electric Auth',      [ -81.7,  30.3]],
  ['GVL',  'Gainesville Regional Utilities',  [ -82.3,  29.7]],
  ['TAL',  'City of Tallahassee FL',          [ -84.3,  30.4]],
  ['HST',  'City of Homestead FL',            [ -80.5,  25.5]],
  ['SEC',  'Seminole Electric',               [ -81.2,  28.6]],
  ['NYIS', 'New York ISO',                    [ -75.5,  43.0]],
  ['ISNE', 'ISO New England',                 [ -71.8,  42.4]],
]

// Extra Voronoi seeds — shapes each BA's territory more accurately
const EXTRA_SEEDS: [string, [number, number]][] = [
  // BPAT — Oregon, Washington, northern Idaho, western Montana
  ['BPAT', [-123.0, 47.5]], ['BPAT', [-120.5, 47.5]], ['BPAT', [-120.5, 45.5]],
  ['BPAT', [-123.5, 44.5]], ['BPAT', [-116.5, 47.8]], ['BPAT', [-118.5, 46.5]],
  // MISO — North Dakota down to Louisiana (trimmed slightly now that SOCO/AECI are added)
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
  // Florida BAs
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

// [name, lon, lat, nameplate_capacity_mw]  — EIA Form 860 (2023)
// Capacity makes dots size-proportional to actual plant scale.

const NUCLEAR_PLANTS: [string, number, number, number][] = [
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

const HYDRO_PLANTS: [string, number, number, number][] = [
  // Columbia River / Pacific NW
  ['Grand Coulee WA',       -118.98, 47.96, 6809],
  ['Chief Joseph WA',       -119.63, 47.98, 2620],
  ['John Day OR/WA',        -120.70, 45.71, 2160],
  ['The Dalles OR',         -121.14, 45.61, 2160],
  ['Rocky Reach WA',        -120.28, 47.37, 1287],
  ['Wanapum WA',            -119.99, 46.87, 1038],
  ['McNary OR/WA',          -119.30, 45.93,  980],
  ['Priest Rapids WA',      -119.91, 46.62,  956],
  ['Bonneville OR/WA',      -121.94, 45.64,  1093],
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

const WIND_FARMS: [string, number, number, number][] = [
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

const GAS_PLANTS: [string, number, number, number][] = [
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

const COAL_PLANTS: [string, number, number, number][] = [
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
  ['Powerton IL',            -89.55, 40.61,  1538],
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
  ['Thomas Hill MO',         -92.62, 39.60,  1201],
  ['Holcomb KS',            -100.97, 37.98,  360],
]

const SOLAR_FARMS: [string, number, number, number][] = [
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

export const BA_COLORS: Record<string, string> = {
  // Western
  BPAT: '#2563eb', PACW: '#0891b2', CISO: '#ca8a04', IPCO: '#0e7490',
  NEVP: '#d97706', PACE: '#7c3aed', AZPS: '#ea580c', SRP:  '#dc2626',
  WACM: '#4f6d9a', PSCO: '#3b5998', AVA:  '#0284c7', DOPD: '#0369a1',
  GCPD: '#075985', CHPD: '#0c4a6e', TPWR: '#1d4ed8', NWMT: '#92400e',
  GWA:  '#78350f', PNM:  '#b45309', EPE:  '#a16207', TEPC: '#92400e',
  IID:  '#c2410c', LDWP: '#9a3412', BANC: '#d97706', TIDC: '#b45309',
  WALC: '#c2410c', HGMA: '#b45309', DEAA: '#a16207',
  // Texas
  ERCO: '#e11d48',
  // Eastern
  SPA:  '#7c3aed', WAUW: '#4338ca', WWA:  '#78350f',
  SWPP: '#059669', MISO: '#16a34a', PJM:  '#6366f1', TVA:  '#0d9488',
  SOCO: '#0f766e', LGEE: '#0891b2', OVEC: '#0e7490', AECI: '#065f46',
  EDE:  '#047857', DUK:  '#65a30d', CPLE: '#4d7c0f', CPLW: '#3f6212',
  SCEG: '#713f12', SC:   '#78350f', SEPA: '#92400e',
  FPL:  '#f59e0b', FPC:  '#d97706', FMPP: '#b45309', JEA:  '#92400e',
  GVL:  '#78350f', TAL:  '#6b7280',
  HST:  '#6b7280', SEC:  '#0d9488',
  NYIS: '#7c3aed', ISNE: '#8b5cf6',
}

function hexToRgb(hex: string) {
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  }
}

function controlPoint(src: [number, number], tgt: [number, number]): [number, number] {
  const mx = (src[0] + tgt[0]) / 2, my = (src[1] + tgt[1]) / 2
  const dx = tgt[0] - src[0], dy = tgt[1] - src[1]
  const len = Math.sqrt(dx * dx + dy * dy) || 1
  return [mx - (dy / len) * len * 0.18, my + (dx / len) * len * 0.18]
}

function bezierPt(t: number, p0: [number, number], cp: [number, number], p1: [number, number]): [number, number] {
  const mt = 1 - t
  return [mt * mt * p0[0] + 2 * mt * t * cp[0] + t * t * p1[0], mt * mt * p0[1] + 2 * mt * t * cp[1] + t * t * p1[1]]
}

interface Arc { src: [number, number]; cp: [number, number]; tgt: [number, number]; norm: number; fwd: boolean; srcId: string; tgtId: string }
interface Particle { src: [number, number]; cp: [number, number]; tgt: [number, number]; t: number; speed: number; norm: number; fwd: boolean; srcId: string; tgtId: string }

interface Props {
  data: GridData | null
  hoveredBA: string | null
  onBAHover: (id: string | null) => void
  mode: Mode
  layers: Set<LayerKey>
  genData: BaGenData[] | null
}

export function GridMap({ data, hoveredBA, onBAHover, mode, layers, genData }: Props) {
  const svgRef    = useRef<SVGSVGElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const dataRef   = useRef<typeof data>(null)  // always-current data for post-load arc build
  const S = useRef({
    transform:      d3.zoomIdentity as d3.ZoomTransform,
    pos:            new Map<string, [number, number]>(),
    arcData:        [] as Arc[],
    particles:      [] as Particle[],
    plantPts:       { nuclear: [] as [number,number,number][], hydro: [] as [number,number,number][], wind: [] as [number,number,number][], solar: [] as [number,number,number][], gas: [] as [number,number,number][], coal: [] as [number,number,number][] },
    raf:            0,
    mode:           'flow' as Mode,
    layerArcs:      true,
    layerParticles: true,
    layerNuclear:   true,
    layerHydro:     true,
    layerWind:      true,
    layerSolar:     true,
    layerGas:       true,
    layerCoal:      true,
    genMap:         new Map<string, BaGenData>(),
  })

  useEffect(() => {
    const svgEl = svgRef.current!, canvasEl = canvasRef.current!
    const W = window.innerWidth, H = window.innerHeight
    const svg = d3.select(svgEl).attr('width', W).attr('height', H)
    canvasEl.width = W; canvasEl.height = H
    const ctx = canvasEl.getContext('2d')!

    const proj = d3.geoAlbersUsa().scale(1200).translate([W / 2, H / 2])
    const path = d3.geoPath().projection(proj)
    const pos  = S.current.pos

    const scene = svg.append('g')
    svg.call(
      d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.5, 12])
        .on('zoom', e => {
          S.current.transform = e.transform
          scene.attr('transform', e.transform.toString())
          const el = document.getElementById('stat-zoom')
          if (el) el.textContent = e.transform.k.toFixed(1) + '\u00d7'
        })
    ).on('dblclick.zoom', null)

    fetch('/us-states.json').then(r => r.json()).then((us: any) => {

      // Continental US land mass (no AK/HI)
      const continental = topojson.merge(
        us, us.objects.states.geometries.filter((g: any) => g.id !== '02' && g.id !== '15')
      ) as any
      scene.append('path')
        .datum(continental)
        .attr('d', path as any)
        .attr('fill', 'rgba(0,0,0,0.04)')
        .attr('stroke', 'none')
        .attr('pointer-events', 'none')

      // Clip mask — continental US only
      const defs = scene.append('defs')
      defs.append('clipPath').attr('id', 'us-clip')
        .append('path').datum(continental).attr('d', path as any)

      // State borders — interior only, very subtle
      scene.append('path')
        .datum(topojson.mesh(us, us.objects.states,
          (a: any, b: any) => a !== b && a.id !== '02' && b.id !== '02' && a.id !== '15' && b.id !== '15'
        ) as any)
        .attr('d', path as any)
        .attr('fill', 'none')
        .attr('stroke', 'rgba(0,0,0,0.07)')
        .attr('stroke-width', 0.5)
        .attr('pointer-events', 'none')

      // Project primary BA positions
      for (const [id, , lonlat] of BA_DEFS) {
        const p = proj(lonlat)
        if (p) pos.set(id, p as [number, number])
      }

      // Project generation facility positions (carries nameplate capacity MW)
      const plantSources: [string, [string, number, number, number][]][] = [
        ['nuclear', NUCLEAR_PLANTS],
        ['hydro',   HYDRO_PLANTS],
        ['wind',    WIND_FARMS],
        ['solar',   SOLAR_FARMS],
        ['gas',     GAS_PLANTS],
        ['coal',    COAL_PLANTS],
      ]
      for (const [fuel, list] of plantSources) {
        const pts = S.current.plantPts[fuel as keyof typeof S.current.plantPts]
        for (const [, lon, lat, cap] of list) {
          const p = proj([lon, lat])
          if (p) pts.push([p[0], p[1], cap] as [number, number, number])
        }
      }

      // If data already arrived before the map loaded, build arcs now
      const d = dataRef.current
      if (d) {
        const maxMW = d3.max(d.links, l => Math.abs(l.value)) ?? 1
        S.current.arcData = d.links.flatMap(l => {
          const src = pos.get(l.source), tgt = pos.get(l.target)
          if (!src || !tgt) return []
          return [{ src, cp: controlPoint(src, tgt), tgt, norm: Math.abs(l.value) / maxMW, fwd: l.value > 0, srcId: l.source, tgtId: l.target }]
        })
      }

      const baWithPos = BA_DEFS.filter(([id]) => pos.has(id))

      // Build multi-seed list: primary + extra seeds for large BAs
      const seeds: Array<{ id: string; pt: [number, number] }> = [
        ...baWithPos.map(([id]) => ({ id, pt: pos.get(id)! })),
      ]
      for (const [id, lonlat] of EXTRA_SEEDS) {
        const p = proj(lonlat)
        if (p) seeds.push({ id, pt: p as [number, number] })
      }

      // Voronoi from all seeds, clipped to US land
      const voronoi = d3.Delaunay
        .from(seeds.map(s => s.pt))
        .voronoi([0, 0, W, H])

      const baGroup = scene.append('g').attr('clip-path', 'url(#us-clip)')
      baGroup.selectAll<SVGPathElement, typeof seeds[number]>('path.ba-fill')
        .data(seeds, s => `${s.id}-${s.pt}`)
        .join('path')
        .attr('class', 'ba-fill')
        .attr('data-ba', s => s.id)
        .attr('d', (_, i) => voronoi.renderCell(i))
        .attr('fill', s => {
          const { r, g, b } = hexToRgb(BA_COLORS[s.id] ?? '#333')
          return `rgba(${r},${g},${b},0.1)`
        })
        .attr('stroke', 'none')
        .attr('pointer-events', 'none')

      // Rings — hidden until hover
      scene.selectAll<SVGCircleElement, (typeof BA_DEFS)[number]>('circle.ba-ring')
        .data(baWithPos, ([id]) => id).join('circle')
        .attr('class', 'ba-ring')
        .attr('cx', ([id]) => pos.get(id)![0]).attr('cy', ([id]) => pos.get(id)![1])
        .attr('r', 10).attr('fill', 'none')
        .attr('stroke', ([id]) => { const { r, g, b } = hexToRgb(BA_COLORS[id] ?? '#333'); return `rgba(${r},${g},${b},0.5)` })
        .attr('stroke-width', 0.8).style('opacity', 0).attr('pointer-events', 'none')

      // Core dots
      scene.selectAll<SVGCircleElement, (typeof BA_DEFS)[number]>('circle.ba-dot')
        .data(baWithPos, ([id]) => id).join('circle')
        .attr('class', 'ba-dot')
        .attr('cx', ([id]) => pos.get(id)![0]).attr('cy', ([id]) => pos.get(id)![1])
        .attr('r', 5)
        .attr('fill', ([id]) => { const { r, g, b } = hexToRgb(BA_COLORS[id] ?? '#333'); return `rgba(${r},${g},${b},0.85)` })
        .attr('stroke', 'rgba(255,255,255,0.9)').attr('stroke-width', 1.2)
        .attr('pointer-events', 'none')

      // Hit circles
      scene.selectAll<SVGCircleElement, (typeof BA_DEFS)[number]>('circle.ba-hit')
        .data(baWithPos, ([id]) => id).join('circle')
        .attr('class', 'ba-hit')
        .attr('cx', ([id]) => pos.get(id)![0]).attr('cy', ([id]) => pos.get(id)![1])
        .attr('r', 18).attr('fill', 'transparent').attr('pointer-events', 'all')
        .style('cursor', 'pointer')
        .on('mouseover', (_e, [id]) => onBAHover(id))
        .on('mouseout',  ()         => onBAHover(null))

      // BA abbreviation label (always visible)
      scene.selectAll<SVGTextElement, (typeof BA_DEFS)[number]>('text.ba-label')
        .data(baWithPos, ([id]) => id).join('text')
        .attr('class', 'ba-label')
        .attr('x', ([id]) => pos.get(id)![0])
        .attr('y', ([id]) => pos.get(id)![1] - 10)
        .attr('text-anchor', 'middle')
        .attr('font-size', 7).attr('font-weight', '500')
        .attr('font-family', 'IBM Plex Mono, monospace')
        .attr('letter-spacing', '0.1em')
        .attr('fill', 'rgba(0,0,0,0.45)')
        .attr('pointer-events', 'none')
        .text(([id]) => id)

      // Full BA name (shown below dot, very subtle)
      scene.selectAll<SVGTextElement, (typeof BA_DEFS)[number]>('text.ba-name')
        .data(baWithPos, ([id]) => id).join('text')
        .attr('class', 'ba-name')
        .attr('x', ([id]) => pos.get(id)![0])
        .attr('y', ([id]) => pos.get(id)![1] + 16)
        .attr('text-anchor', 'middle')
        .attr('font-size', 5.5).attr('font-weight', '400')
        .attr('font-family', 'IBM Plex Mono, monospace')
        .attr('letter-spacing', '0.06em')
        .attr('fill', 'rgba(0,0,0,0.18)')
        .attr('pointer-events', 'none')
        .text(([, name]) => name)
    })

    // ── Render loop ───────────────────────────────────────────────────────
    function frame() {
      const { transform: T, arcData, particles, plantPts, mode: m,
              layerArcs, layerParticles, layerNuclear, layerHydro, layerWind, layerSolar,
              layerGas, layerCoal, genMap, pos } = S.current
      ctx.setTransform(T.k, 0, 0, T.k, T.x, T.y)
      ctx.clearRect(-T.x / T.k, -T.y / T.k, W / T.k, H / T.k)

      // ── Flow mode ────────────────────────────────────────────────────
      if (m === 'flow' && arcData.length > 0) {
        if (layerArcs) {
          ctx.lineCap = 'round'
          for (const arc of arcData) {
            const { src, cp, tgt, norm, fwd, srcId, tgtId } = arc
            const srcColor = hexToRgb(BA_COLORS[srcId] ?? (fwd ? '#2563eb' : '#ea580c'))
            const tgtColor = hexToRgb(BA_COLORS[tgtId] ?? (fwd ? '#2563eb' : '#ea580c'))

            // Gradient along arc midpoint
            const mid = bezierPt(0.5, src, cp, tgt)
            const grad = ctx.createLinearGradient(src[0], src[1], tgt[0], tgt[1])
            grad.addColorStop(0,   `rgba(${srcColor.r},${srcColor.g},${srcColor.b},${0.15 + norm * 0.25})`)
            grad.addColorStop(0.5, `rgba(${mid[0] > 0 ? srcColor.r : tgtColor.r},${srcColor.g},${srcColor.b},${0.25 + norm * 0.35})`)
            grad.addColorStop(1,   `rgba(${tgtColor.r},${tgtColor.g},${tgtColor.b},${0.15 + norm * 0.25})`)

            // Wide glow
            ctx.beginPath(); ctx.moveTo(src[0], src[1]); ctx.quadraticCurveTo(cp[0], cp[1], tgt[0], tgt[1])
            ctx.strokeStyle = `rgba(${srcColor.r},${srcColor.g},${srcColor.b},${0.03 + norm * 0.05})`
            ctx.lineWidth = (8 + norm * 12) / T.k; ctx.stroke()

            // Core line with gradient
            ctx.beginPath(); ctx.moveTo(src[0], src[1]); ctx.quadraticCurveTo(cp[0], cp[1], tgt[0], tgt[1])
            ctx.strokeStyle = grad
            ctx.lineWidth = (0.8 + norm * 1.5) / T.k
            ctx.shadowColor = `rgba(${srcColor.r},${srcColor.g},${srcColor.b},0.4)`
            ctx.shadowBlur  = (4 + norm * 8) / T.k
            ctx.stroke(); ctx.shadowBlur = 0
          }
        }

        if (layerParticles) {
          for (const arc of arcData) {
            if (Math.random() < 0.05 + arc.norm * 0.12) particles.push({
              ...arc,
              t:     arc.fwd ? 0 : 1,
              speed: (0.004 + arc.norm * 0.01) * (arc.fwd ? 1 : -1),
            })
          }
          S.current.particles = particles.filter(p => { p.t += p.speed; return p.t >= 0 && p.t <= 1 })
          if (S.current.particles.length > 1500) S.current.particles.splice(0, S.current.particles.length - 1500)

          for (const p of S.current.particles) {
            const [x, y] = bezierPt(p.t, p.src, p.cp, p.tgt)
            const c = hexToRgb(BA_COLORS[p.fwd ? p.srcId : p.tgtId] ?? '#2563eb')
            const pr = (1.2 + p.norm * 0.8) / T.k
            ctx.beginPath(); ctx.arc(x, y, pr, 0, Math.PI * 2)
            ctx.fillStyle   = `rgba(${c.r},${c.g},${c.b},${0.6 + p.norm * 0.35})`
            ctx.shadowColor = `rgba(${c.r},${c.g},${c.b},0.7)`
            ctx.shadowBlur  = (4 + p.norm * 6) / T.k
            ctx.fill(); ctx.shadowBlur = 0
          }
        }
      }

      // ── Generation mode — fuel-mix donut rings ───────────────────────
      if (m === 'generation' && genMap.size > 0) {
        let maxMw = 0
        for (const [, d] of genMap) if (d.totalMw > maxMw) maxMw = d.totalMw

        for (const [baId, gd] of genMap) {
          const p = pos.get(baId)
          if (!p) continue
          const norm      = Math.sqrt(gd.totalMw / Math.max(maxMw, 1))
          const outerR    = (10 + norm * 32) / T.k
          const innerR    = outerR * 0.58
          const ringWidth = outerR - innerR

          // Soft bloom behind ring
          const bloom = ctx.createRadialGradient(p[0], p[1], innerR, p[0], p[1], outerR * 2)
          const dc = hexToRgb(FUEL_COLORS[gd.dominantFuel] ?? '#6b7280')
          bloom.addColorStop(0,   `rgba(${dc.r},${dc.g},${dc.b},0.12)`)
          bloom.addColorStop(1,   `rgba(${dc.r},${dc.g},${dc.b},0)`)
          ctx.beginPath(); ctx.arc(p[0], p[1], outerR * 2, 0, Math.PI * 2)
          ctx.fillStyle = bloom; ctx.fill()

          // Fuel-mix donut ring
          let angle = -Math.PI / 2
          const gap  = 0.03
          for (const { fuel, mw } of gd.fuels) {
            if (mw <= 0) continue
            const sweep = (mw / gd.totalMw) * Math.PI * 2 - gap
            if (sweep <= 0) continue
            const fc = hexToRgb(FUEL_COLORS[fuel] ?? '#6b7280')
            ctx.beginPath()
            ctx.arc(p[0], p[1], outerR, angle, angle + sweep)
            ctx.arc(p[0], p[1], innerR, angle + sweep, angle, true)
            ctx.closePath()
            ctx.fillStyle   = `rgba(${fc.r},${fc.g},${fc.b},0.82)`
            ctx.shadowColor = `rgba(${fc.r},${fc.g},${fc.b},0.4)`
            ctx.shadowBlur  = ringWidth * T.k * 0.6
            ctx.fill(); ctx.shadowBlur = 0
            angle += sweep + gap
          }

          // White center cap
          ctx.beginPath(); ctx.arc(p[0], p[1], innerR * 0.85, 0, Math.PI * 2)
          ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fill()
        }
      }

      // ── Generation facility layers — dot size ∝ √(nameplate MW) ────────
      // Helper: base radius scaled by capacity relative to the layer's max
      function capR(cap: number, maxCap: number, minPx: number, maxPx: number) {
        return (minPx + Math.sqrt(cap / maxCap) * (maxPx - minPx)) / T.k
      }

      // nuclear — purple cross + dot
      if (layerNuclear && plantPts.nuclear.length > 0) {
        const maxCap = Math.max(...plantPts.nuclear.map(p => p[2]))
        ctx.lineWidth = 0.8 / T.k
        for (const [x, y, cap] of plantPts.nuclear) {
          const r = capR(cap, maxCap, 1.5, 5.5)
          const halo = ctx.createRadialGradient(x, y, 0, x, y, r * 5)
          halo.addColorStop(0, 'rgba(139,92,246,0.2)'); halo.addColorStop(1, 'rgba(139,92,246,0)')
          ctx.beginPath(); ctx.arc(x, y, r * 5, 0, Math.PI * 2); ctx.fillStyle = halo; ctx.fill()
          ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2)
          ctx.fillStyle = 'rgba(139,92,246,0.9)'
          ctx.shadowColor = 'rgba(139,92,246,0.6)'; ctx.shadowBlur = r * 3
          ctx.fill(); ctx.shadowBlur = 0
          const arm = r * 2.2
          ctx.strokeStyle = 'rgba(139,92,246,0.4)'
          ctx.beginPath()
          ctx.moveTo(x - arm, y); ctx.lineTo(x + arm, y)
          ctx.moveTo(x, y - arm); ctx.lineTo(x, y + arm)
          ctx.stroke()
        }
      }

      // hydro — blue diamond, Grand Coulee visibly largest
      if (layerHydro && plantPts.hydro.length > 0) {
        const maxCap = Math.max(...plantPts.hydro.map(p => p[2]))
        for (const [x, y, cap] of plantPts.hydro) {
          const r = capR(cap, maxCap, 1.2, 6.0)
          const halo = ctx.createRadialGradient(x, y, 0, x, y, r * 5)
          halo.addColorStop(0, 'rgba(37,99,235,0.18)'); halo.addColorStop(1, 'rgba(37,99,235,0)')
          ctx.beginPath(); ctx.arc(x, y, r * 5, 0, Math.PI * 2); ctx.fillStyle = halo; ctx.fill()
          const d = r * 1.5
          ctx.beginPath()
          ctx.moveTo(x, y - d); ctx.lineTo(x + d, y); ctx.lineTo(x, y + d); ctx.lineTo(x - d, y)
          ctx.closePath()
          ctx.fillStyle = 'rgba(37,99,235,0.85)'
          ctx.shadowColor = 'rgba(37,99,235,0.5)'; ctx.shadowBlur = r * 3
          ctx.fill(); ctx.shadowBlur = 0
        }
      }

      // wind — teal triangle
      if (layerWind && plantPts.wind.length > 0) {
        const maxCap = Math.max(...plantPts.wind.map(p => p[2]))
        for (const [x, y, cap] of plantPts.wind) {
          const r = capR(cap, maxCap, 1.2, 5.0)
          const halo = ctx.createRadialGradient(x, y, 0, x, y, r * 5)
          halo.addColorStop(0, 'rgba(8,145,178,0.16)'); halo.addColorStop(1, 'rgba(8,145,178,0)')
          ctx.beginPath(); ctx.arc(x, y, r * 5, 0, Math.PI * 2); ctx.fillStyle = halo; ctx.fill()
          ctx.beginPath()
          ctx.moveTo(x, y - r * 1.6)
          ctx.lineTo(x + r * 1.4, y + r * 0.9)
          ctx.lineTo(x - r * 1.4, y + r * 0.9)
          ctx.closePath()
          ctx.fillStyle = 'rgba(8,145,178,0.85)'
          ctx.shadowColor = 'rgba(8,145,178,0.5)'; ctx.shadowBlur = r * 3
          ctx.fill(); ctx.shadowBlur = 0
        }
      }

      // solar — amber circle with rays
      if (layerSolar && plantPts.solar.length > 0) {
        const maxCap = Math.max(...plantPts.solar.map(p => p[2]))
        ctx.lineWidth = 0.7 / T.k
        for (const [x, y, cap] of plantPts.solar) {
          const r = capR(cap, maxCap, 1.2, 5.0)
          const halo = ctx.createRadialGradient(x, y, 0, x, y, r * 5)
          halo.addColorStop(0, 'rgba(217,119,6,0.2)'); halo.addColorStop(1, 'rgba(217,119,6,0)')
          ctx.beginPath(); ctx.arc(x, y, r * 5, 0, Math.PI * 2); ctx.fillStyle = halo; ctx.fill()
          ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2)
          ctx.fillStyle = 'rgba(217,119,6,0.9)'
          ctx.shadowColor = 'rgba(217,119,6,0.5)'; ctx.shadowBlur = r * 3
          ctx.fill(); ctx.shadowBlur = 0
          ctx.strokeStyle = 'rgba(217,119,6,0.38)'
          const rayLen = r * 1.8
          for (let i = 0; i < 8; i++) {
            const a = (i / 8) * Math.PI * 2
            const inner = r * 1.35, outer = inner + rayLen
            ctx.beginPath()
            ctx.moveTo(x + Math.cos(a) * inner, y + Math.sin(a) * inner)
            ctx.lineTo(x + Math.cos(a) * outer, y + Math.sin(a) * outer)
            ctx.stroke()
          }
        }
      }

      // gas — orange square (industrial)
      if (layerGas && plantPts.gas.length > 0) {
        const maxCap = Math.max(...plantPts.gas.map(p => p[2]))
        for (const [x, y, cap] of plantPts.gas) {
          const r = capR(cap, maxCap, 1.2, 5.0)
          const halo = ctx.createRadialGradient(x, y, 0, x, y, r * 5)
          halo.addColorStop(0, 'rgba(234,88,12,0.18)'); halo.addColorStop(1, 'rgba(234,88,12,0)')
          ctx.beginPath(); ctx.arc(x, y, r * 5, 0, Math.PI * 2); ctx.fillStyle = halo; ctx.fill()
          const s = r * 1.3
          ctx.beginPath()
          ctx.rect(x - s, y - s, s * 2, s * 2)
          ctx.fillStyle = 'rgba(234,88,12,0.85)'
          ctx.shadowColor = 'rgba(234,88,12,0.5)'; ctx.shadowBlur = r * 3
          ctx.fill(); ctx.shadowBlur = 0
        }
      }

      // coal — dark red pentagon
      if (layerCoal && plantPts.coal.length > 0) {
        const maxCap = Math.max(...plantPts.coal.map(p => p[2]))
        for (const [x, y, cap] of plantPts.coal) {
          const r = capR(cap, maxCap, 1.2, 5.5)
          const halo = ctx.createRadialGradient(x, y, 0, x, y, r * 5)
          halo.addColorStop(0, 'rgba(220,38,38,0.16)'); halo.addColorStop(1, 'rgba(220,38,38,0)')
          ctx.beginPath(); ctx.arc(x, y, r * 5, 0, Math.PI * 2); ctx.fillStyle = halo; ctx.fill()
          // Pentagon
          ctx.beginPath()
          for (let i = 0; i < 5; i++) {
            const a = (i / 5) * Math.PI * 2 - Math.PI / 2
            const px = x + r * 1.5 * Math.cos(a), py = y + r * 1.5 * Math.sin(a)
            i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)
          }
          ctx.closePath()
          ctx.fillStyle = 'rgba(220,38,38,0.85)'
          ctx.shadowColor = 'rgba(220,38,38,0.5)'; ctx.shadowBlur = r * 3
          ctx.fill(); ctx.shadowBlur = 0
        }
      }

      S.current.raf = requestAnimationFrame(frame)
    }
    S.current.raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(S.current.raf)
      svg.selectAll('*').remove(); svg.on('.zoom', null)
      S.current.pos.clear(); S.current.arcData = []; S.current.particles = []
      S.current.plantPts = { nuclear: [] as [number,number,number][], hydro: [] as [number,number,number][], wind: [] as [number,number,number][], solar: [] as [number,number,number][], gas: [] as [number,number,number][], coal: [] as [number,number,number][] }
    }
  }, []) // eslint-disable-line

  // ── Hover highlight ───────────────────────────────────────────────────
  useEffect(() => {
    const svg = d3.select(svgRef.current!)
    const pos = S.current.pos

    svg.selectAll<SVGPathElement, any>('.ba-fill')
      .each(function () {
        const baId     = d3.select(this).attr('data-ba')
        const isHovered = baId === hoveredBA
        const { r, g, b } = hexToRgb(BA_COLORS[baId] ?? '#333333')
        d3.select(this).transition().duration(200)
          .attr('fill', isHovered ? `rgba(${r},${g},${b},0.22)` : `rgba(${r},${g},${b},0.1)`)
      })

    svg.selectAll<SVGCircleElement, (typeof BA_DEFS)[number]>('circle.ba-ring')
      .transition().duration(200)
      .attr('r',       ([id]) => id === hoveredBA ? 17 : 10)
      .style('opacity',([id]) => id === hoveredBA ? 0.65 : 0)

    svg.selectAll<SVGCircleElement, (typeof BA_DEFS)[number]>('circle.ba-dot')
      .transition().duration(200)
      .attr('r',    ([id]) => id === hoveredBA ? 8 : 5)
      .attr('fill', ([id]) => {
        const { r, g, b } = hexToRgb(BA_COLORS[id] ?? '#333')
        return id === hoveredBA ? `rgba(${r},${g},${b},1)` : `rgba(${r},${g},${b},0.85)`
      })
      .attr('stroke-width', ([id]) => id === hoveredBA ? 2 : 1.2)

    svg.selectAll<SVGTextElement, (typeof BA_DEFS)[number]>('text.ba-label')
      .transition().duration(200)
      .attr('font-size',     ([id]) => id === hoveredBA ? 11 : 7)
      .attr('font-weight',   ([id]) => id === hoveredBA ? '600' : '500')
      .attr('letter-spacing',([id]) => id === hoveredBA ? '0.14em' : '0.1em')
      .attr('y', ([id]) => { const p = pos.get(id); return p ? p[1] - (id === hoveredBA ? 18 : 10) : 0 })
      .attr('fill', ([id]) => {
        if (id !== hoveredBA) return 'rgba(0,0,0,0.45)'
        const { r, g, b } = hexToRgb(BA_COLORS[id] ?? '#333')
        return `rgba(${r},${g},${b},1)`
      })

    svg.selectAll<SVGTextElement, (typeof BA_DEFS)[number]>('text.ba-name')
      .transition().duration(200)
      .attr('fill', ([id]) => {
        if (id !== hoveredBA) return 'rgba(0,0,0,0.18)'
        const { r, g, b } = hexToRgb(BA_COLORS[id] ?? '#333')
        return `rgba(${r},${g},${b},0.7)`
      })
      .attr('font-size', ([id]) => id === hoveredBA ? 7 : 5.5)
  }, [hoveredBA])

  // ── Rebuild arcs on new data ──────────────────────────────────────────
  useEffect(() => {
    dataRef.current = data
    if (!data) return
    const pos = S.current.pos
    if (!pos.size) return  // pos not ready yet — map setup will build arcs on load
    const maxMW = d3.max(data.links, d => Math.abs(d.value)) ?? 1
    S.current.particles = []
    S.current.arcData   = data.links.flatMap(l => {
      const src = pos.get(l.source), tgt = pos.get(l.target)
      if (!src || !tgt) return []
      return [{ src, cp: controlPoint(src, tgt), tgt, norm: Math.abs(l.value) / maxMW, fwd: l.value > 0, srcId: l.source, tgtId: l.target }]
    })
  }, [data])

  useEffect(() => {
    S.current.mode           = mode
    S.current.layerArcs      = layers.has('arcs')
    S.current.layerParticles = layers.has('particles')
    S.current.layerNuclear   = layers.has('nuclear')
    S.current.layerHydro     = layers.has('hydro')
    S.current.layerWind      = layers.has('wind')
    S.current.layerSolar     = layers.has('solar')
    S.current.layerGas       = layers.has('gas')
    S.current.layerCoal      = layers.has('coal')
    if (mode !== 'flow') S.current.particles = []
  }, [mode, layers])

  useEffect(() => {
    const m = new Map<string, BaGenData>()
    if (genData) genData.forEach(d => m.set(d.ba, d))
    S.current.genMap = m
  }, [genData])

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <svg    ref={svgRef}    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
    </div>
  )
}
