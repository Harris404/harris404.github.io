/**
 * Education Tool — CRICOS courses & institutions + QS rankings + AQF
 */

// ───── QS World University Rankings 2025 (Australian universities) ─────
// Source: QS World University Rankings 2025. Subject rankings = QS by Subject 2024.
// Note: "top10_subjects" = QS Subject Rankings top placement for this university
const QS_RANKINGS = {
  'University of Melbourne': {
    qs_world: 13, qs_aus: 1,
    strengths: ['Medicine & Health Sciences', 'Arts & Humanities', 'Law', 'Business'],
    top_subjects: { 'Education': 4, 'Law': 12, 'Architecture': 16, 'Nursing': 18, 'Medicine': 33 },
    research_focus: 'Melbourne Research (MR) – biomedical, quantum computing, social sciences',
    era_rating: 'ERA 5 (well above world standard) in many fields',
    acceptance_rate: '~70% (undergrad), more selective for postgrad',
    intl_student_pct: '~40%'
  },
  'University of Sydney': {
    qs_world: 18, qs_aus: 2,
    strengths: ['Business', 'Medicine', 'Engineering', 'Arts'],
    top_subjects: { 'Pharmacy': 16, 'Nursing': 22, 'Architecture': 24, 'Law': 24, 'Agriculture': 26 },
    research_focus: 'Charles Perkins Centre (health), Nano Institute, Space Innovation Hub',
    era_rating: 'ERA 5 in 39 fields',
    acceptance_rate: '~60%',
    intl_student_pct: '~40%'
  },
  'University of New South Wales': {
    qs_world: 19, qs_aus: 3,
    strengths: ['Engineering', 'Computer Science', 'Business', 'Law'],
    top_subjects: { 'Mining & Mineral Engineering': 12, 'Computer Science & IS': 36, 'Engineering - Civil': 38, 'Business & Management': 56 },
    research_focus: 'UNSW Institute for Cyber Security, AI Research Group, Photovoltaics',
    era_rating: 'ERA 5 in 22 fields',
    acceptance_rate: '~60%',
    intl_student_pct: '~40%'
  },
  'Australian National University': {
    qs_world: 30, qs_aus: 4,
    strengths: ['Politics & International Studies', 'Physics', 'Earth Sciences', 'Philosophy'],
    top_subjects: { 'Politics & International Studies': 15, 'Geography': 20, 'Earth & Marine Sciences': 17, 'Physics & Astronomy': 54 },
    research_focus: 'Research-intensive; ANU Institute for Climate, Energy & Disaster Solutions',
    era_rating: 'ERA 5 in 36 fields',
    acceptance_rate: '~55%',
    intl_student_pct: '~30%'
  },
  'University of Queensland': {
    qs_world: 40, qs_aus: 5,
    strengths: ['Agriculture', 'Mining Engineering', 'Medicine', 'Environmental Science'],
    top_subjects: { 'Agriculture': 8, 'Mining & Mineral Engineering': 15, 'Anatomy': 19, 'Veterinary Science': 19, 'Pharmacy': 22 },
    research_focus: 'IMB Institute for Molecular Bioscience, AIBN, Advanced Design Technology',
    era_rating: 'ERA 5 in 38 fields',
    acceptance_rate: '~65%',
    intl_student_pct: '~30%'
  },
  'Monash University': {
    qs_world: 55, qs_aus: 6,
    strengths: ['Pharmacy', 'Engineering', 'Medicine', 'Business'],
    top_subjects: { 'Pharmacy': 17, 'Engineering - Chemical': 33, 'Medicine': 53, 'Nursing': 37 },
    research_focus: 'Monash Institute of Pharmaceutical Sciences, ARC Centres of Excellence',
    era_rating: 'ERA 5 in 23 fields',
    acceptance_rate: '~70%',
    intl_student_pct: '~35%'
  },
  'University of Western Australia': {
    qs_world: 72, qs_aus: 7,
    strengths: ['Mining Engineering', 'Agriculture', 'Marine Science', 'Earth Sciences'],
    top_subjects: { 'Mining & Mineral Engineering': 7, 'Agriculture': 24, 'Earth Sciences': 39 },
    research_focus: 'Oceans Institute, Harry Perkins Institute of Medical Research',
    era_rating: 'ERA 5 in 20 fields',
    acceptance_rate: '~65%',
    intl_student_pct: '~25%'
  },
  'University of Adelaide': {
    qs_world: 89, qs_aus: 8,
    strengths: ['Agriculture', 'Wine & Oenology', 'Mining Engineering', 'Medicine'],
    top_subjects: { 'Agriculture': 21, 'Mining & Mineral Engineering': 22 },
    research_focus: 'Australian Institute for Machine Learning, Institute for Photonics & Advanced Sensing',
    era_rating: 'ERA 5 in 16 fields',
    acceptance_rate: '~70%',
    intl_student_pct: '~28%'
  },
  'University of Technology Sydney': {
    qs_world: 131, qs_aus: 9,
    strengths: ['Information Technology', 'Business', 'Design', 'Engineering'],
    top_subjects: { 'Computer Science & IS': 50, 'Business & Management': 120, 'Arts & Design': 55 },
    research_focus: 'UTS Tech Lab, Human Technology Institute, Centre for Data Science',
    era_rating: 'ERA 4-5 in many fields',
    acceptance_rate: '~70%',
    intl_student_pct: '~40%'
  },
  'Macquarie University': {
    qs_world: 195, qs_aus: 10,
    strengths: ['Linguistics', 'Actuarial Science', 'Cognitive Science', 'Finance'],
    top_subjects: { 'Linguistics': 22, 'Anatomy & Physiology': 45 },
    research_focus: 'Macquarie University Research Centre (archaeology, astronomy, environment)',
    era_rating: 'ERA 4-5 in 18 fields',
    acceptance_rate: '~70%',
    intl_student_pct: '~35%'
  },
  'University of Wollongong': {
    qs_world: 197, qs_aus: 11,
    strengths: ['Materials Science', 'Engineering', 'Education', 'Business'],
    top_subjects: {},
    research_focus: 'AIIM (Australian Institute for Innovative Materials), Smart Infrastructure',
    era_rating: 'ERA 4-5 in 12 fields',
    acceptance_rate: '~75%',
    intl_student_pct: '~30%'
  },
  'Queensland University of Technology': {
    qs_world: 200, qs_aus: 12,
    strengths: ['Information Technology', 'Business', 'Design', 'Education'],
    top_subjects: { 'Computer Science & IS': 100 },
    research_focus: 'QUT Digital Media Research Centre, ARC Centre ACEMS (statistics)',
    era_rating: 'ERA 4-5 in 16 fields',
    acceptance_rate: '~75%',
    intl_student_pct: '~25%'
  },
  'RMIT University': {
    qs_world: 221, qs_aus: 13,
    strengths: ['Art & Design', 'Engineering', 'Business', 'Architecture'],
    top_subjects: { 'Art & Design': 50, 'Architecture': 100 },
    research_focus: 'RMIT Centre for Additive Manufacturing, Global Cities Research Institute',
    era_rating: 'ERA 4-5 in 15 fields',
    acceptance_rate: '~75%',
    intl_student_pct: '~40%'
  },
  'Curtin University': {
    qs_world: 225, qs_aus: 14,
    strengths: ['Mining Engineering', 'Geology', 'Business', 'Health Sciences'],
    top_subjects: { 'Mining & Mineral Engineering': 25 },
    research_focus: 'Space Science & Technology Centre, WASM Minerals & Energy Research Institute',
    era_rating: 'ERA 4-5 in 14 fields',
    acceptance_rate: '~75%',
    intl_student_pct: '~35%'
  },
  'Deakin University': {
    qs_world: 310, qs_aus: 15,
    strengths: ['Nursing', 'Health Sciences', 'Business', 'Education'],
    top_subjects: { 'Nursing': 45 },
    research_focus: 'Deakin Applied Artificial Intelligence Institute (D2AI)',
    era_rating: 'ERA 4 in 13 fields',
    acceptance_rate: '~80%',
    intl_student_pct: '~30%'
  },
  'Griffith University': {
    qs_world: 376, qs_aus: 16,
    strengths: ['Criminology', 'Tourism', 'Music', 'Environmental Science'],
    top_subjects: {},
    research_focus: 'Griffith Institute for Drug Discovery, Cities Research Institute',
    era_rating: 'ERA 4-5 in 10 fields',
    acceptance_rate: '~80%',
    intl_student_pct: '~25%'
  },
  'University of Newcastle': {
    qs_world: 487, qs_aus: 17,
    strengths: ['Medicine', 'Engineering', 'Education', 'Business'],
    top_subjects: {},
    research_focus: 'Priority Research Centres: energy, materials, health',
    era_rating: 'ERA 4 in 10 fields',
    acceptance_rate: '~80%',
    intl_student_pct: '~20%'
  },
  'La Trobe University': {
    qs_world: 501, qs_aus: 18,
    strengths: ['Agriculture', 'Public Health', 'Education', 'Business'],
    top_subjects: {},
    research_focus: 'La Trobe Institute for Molecular Science, Research Focus Areas',
    era_rating: 'ERA 3-4 in many fields',
    acceptance_rate: '~80%',
    intl_student_pct: '~25%'
  },
  'Swinburne University': {
    qs_world: 451, qs_aus: 17,
    strengths: ['Engineering', 'Information Technology', 'Design', 'Business'],
    top_subjects: {},
    research_focus: 'Industry 4.0 Hub, Space Design Group',
    era_rating: 'ERA 3-4 in 10 fields',
    acceptance_rate: '~80%',
    intl_student_pct: '~30%'
  },
  'Western Sydney University': {
    qs_world: 501, qs_aus: 19,
    strengths: ['Nursing', 'Law', 'Business', 'Social Sciences'],
    top_subjects: {},
    research_focus: 'MARCS Institute for Brain, Behaviour & Development',
    era_rating: 'ERA 3-4 in 8 fields',
    acceptance_rate: '~85%',
    intl_student_pct: '~25%'
  },
  'Flinders University': {
    qs_world: 401, qs_aus: 16,
    strengths: ['Medicine', 'Nursing', 'Archaeology', 'Environmental Science'],
    top_subjects: {},
    research_focus: 'Flinders Health and Medical Research Institute, Matthew Flinders Fellowship',
    era_rating: 'ERA 3-4 in 10 fields',
    acceptance_rate: '~80%',
    intl_student_pct: '~20%'
  }
};

// ───── AQF Levels Reference ─────
const AQF_LEVELS = {
  1: {
    name: 'Certificate I',
    sector: 'VET',
    typical_duration: '6 months',
    providers: 'TAFE, Registered Training Organisations (RTOs)',
    entry: 'No formal requirements',
    purpose: 'Basic work-related skills and knowledge',
    examples: 'Certificate I in Tourism, Certificate I in Construction'
  },
  2: {
    name: 'Certificate II',
    sector: 'VET',
    typical_duration: '6-12 months',
    providers: 'TAFE, RTOs',
    entry: 'No formal requirements or Certificate I',
    purpose: 'Practically-focused skills for defined roles',
    examples: 'Certificate II in Kitchen Operations, Certificate II in Security Operations'
  },
  3: {
    name: 'Certificate III',
    sector: 'VET',
    typical_duration: '1-1.5 years',
    providers: 'TAFE, RTOs',
    entry: 'Certificate II or comparable work experience',
    purpose: 'Specific trade/occupational skills; pathway to apprenticeships',
    examples: 'Certificate III in Carpentry, Certificate III in Individual Support (aged care)',
    note: 'Trade apprenticeships are typically cert III level'
  },
  4: {
    name: 'Certificate IV',
    sector: 'VET',
    typical_duration: '6 months – 2 years',
    providers: 'TAFE, RTOs',
    entry: 'Certificate III or Year 12',
    purpose: 'Supervisory/management skills; pathway to higher study',
    examples: 'Certificate IV in Accounting & Bookkeeping, Certificate IV in Building Design',
    note: 'Can serve as pathway into Diploma programs'
  },
  5: {
    name: 'Diploma',
    sector: 'VET or Higher Education',
    typical_duration: '1-2 years',
    providers: 'TAFE, RTOs, Colleges, some Universities',
    entry: 'Certificate IV, Year 12, or work experience',
    purpose: 'Specialist knowledge for skilled/supervised work; pathway to bachelor degree',
    examples: 'Diploma of IT, Diploma of Business, Diploma of Nursing (EN)',
    note: 'Completing a Diploma may allow credit into year 2 of a related Bachelor degree'
  },
  6: {
    name: 'Advanced Diploma / Associate Degree',
    sector: 'VET or Higher Education',
    typical_duration: '1.5-2 years',
    providers: 'TAFE, RTOs, Universities',
    entry: 'Diploma or Year 12',
    purpose: 'In-depth specialised knowledge; paraprofessional role',
    examples: 'Advanced Diploma of Accounting, Associate Degree in Engineering',
    note: 'Associate Degree is typically a University award; may articulate into year 2 of Bachelor'
  },
  7: {
    name: 'Bachelor Degree',
    sector: 'Higher Education',
    typical_duration: '3-4 years (full-time)',
    providers: 'Universities, Approved Higher Education Providers',
    entry: 'Year 12 (ATAR) or Diploma/Advanced Diploma',
    purpose: 'Broad entry-level professional qualification',
    examples: 'Bachelor of Computer Science, Bachelor of Commerce, Bachelor of Nursing',
    note: 'International students need minimum IELTS 6.0-6.5 typically; ATAR varies (50-99+)'
  },
  8: {
    name: 'Bachelor Honours / Graduate Certificate / Graduate Diploma',
    sector: 'Higher Education',
    typical_duration: '1-2 years (or Honours added to Bachelor = 4 years total)',
    providers: 'Universities',
    entry: 'Bachelor Degree (minimum credit average for Honours)',
    purpose: 'Advanced specialisation; research introduction; career change pathway',
    examples: 'Bachelor of Engineering (Hons), Graduate Certificate in Business Analysis, Graduate Diploma of Psychology'
  },
  9: {
    name: "Master's Degree",
    sector: 'Higher Education',
    typical_duration: '1.5-2 years (coursework); 2 years (research)',
    providers: 'Universities',
    entry: 'Bachelor Degree (usually 65%+ average); some need relevant work experience',
    purpose: 'Advanced professional or research qualification',
    examples: "Master of Computer Science, Master of Business Administration (MBA), Master of Engineering",
    two_types: {
      coursework: 'MC – industry-focused, taught subjects, sometimes includes minor thesis',
      research: 'MPhil or MRes – primarily research-based thesis'
    },
    note: 'International students usually need IELTS 6.5 overall (6.0 per band) minimum'
  },
  10: {
    name: 'Doctoral Degree',
    sector: 'Higher Education',
    typical_duration: '3-5 years (full-time); 6-8 years (part-time)',
    providers: 'Universities',
    entry: "Master's Degree or equivalent research experience; supervisor matching required",
    purpose: 'Original research contribution; highest academic qualification',
    examples: 'Doctor of Philosophy (PhD), Doctor of Engineering, Professional Doctorate',
    vet_equivalent: 'None — AQF Level 10 is exclusively higher education',
    note: "International PhD students often receive government scholarships (e.g., AusAID, RTP). Tuition fees: ~$35,000-$45,000/year but many PhD positions are fully or partially funded.",
    funding: 'Research Training Program (RTP) — provides tuition offset + living allowance for domestic & some international students'
  }
};

// ───── QS Subject Rankings 2024 — AU universities by discipline ─────
const QS_BY_SUBJECT = {
  'Computer Science & Information Systems': {
    ranking: [
      { rank: '36', uni: 'University of New South Wales' },
      { rank: '51-100', uni: 'University of Melbourne' },
      { rank: '51-100', uni: 'University of Sydney' },
      { rank: '51-100', uni: 'University of Queensland' },
      { rank: '101-150', uni: 'University of Technology Sydney' },
      { rank: '101-150', uni: 'Monash University' },
      { rank: '151-200', uni: 'Queensland University of Technology' },
      { rank: '201-250', uni: 'Australian National University' }
    ]
  },
  'Business & Management Studies': {
    ranking: [
      { rank: '51-100', uni: 'University of Melbourne' },
      { rank: '51-100', uni: 'University of New South Wales' },
      { rank: '51-100', uni: 'University of Sydney' },
      { rank: '51-100', uni: 'University of Queensland' },
      { rank: '101-150', uni: 'Monash University' },
      { rank: '101-150', uni: 'Australian National University' },
      { rank: '151-200', uni: 'University of Technology Sydney' }
    ]
  },
  'Engineering & Technology': {
    ranking: [
      { rank: '12', uni: 'University of New South Wales (Mining Engineering)' },
      { rank: '29', uni: 'University of Melbourne' },
      { rank: '51-100', uni: 'University of Queensland' },
      { rank: '51-100', uni: 'Monash University' },
      { rank: '51-100', uni: 'University of Sydney' },
      { rank: '101-150', uni: 'RMIT University' },
      { rank: '101-150', uni: 'University of Adelaide' }
    ]
  },
  'Medicine & Health Sciences': {
    ranking: [
      { rank: '33', uni: 'University of Melbourne' },
      { rank: '51-100', uni: 'University of Sydney' },
      { rank: '51-100', uni: 'University of Queensland' },
      { rank: '51-100', uni: 'Monash University' },
      { rank: '101-150', uni: 'University of Adelaide' },
      { rank: '101-150', uni: 'University of Western Australia' },
      { rank: '101-150', uni: 'Deakin University (Nursing)' }
    ]
  },
  'Law & Legal Studies': {
    ranking: [
      { rank: '12', uni: 'University of Melbourne' },
      { rank: '24', uni: 'University of Sydney' },
      { rank: '51-100', uni: 'University of New South Wales' },
      { rank: '51-100', uni: 'Australian National University' },
      { rank: '51-100', uni: 'University of Queensland' }
    ]
  },
  'Natural Sciences': {
    ranking: [
      { rank: '15', uni: 'Australian National University (Politics/Intl Studies)' },
      { rank: '51-100', uni: 'University of Melbourne' },
      { rank: '51-100', uni: 'University of Sydney' },
      { rank: '101-150', uni: 'University of Queensland' }
    ]
  },
  'Agriculture & Forestry': {
    ranking: [
      { rank: '8', uni: 'University of Queensland' },
      { rank: '21', uni: 'University of Adelaide' },
      { rank: '24', uni: 'University of Western Australia' },
      { rank: '27', uni: 'University of Melbourne' }
    ]
  }
};

// ───── Major Australian universities for CRICOS lookup ─────
// CRICOS codes verified against data.gov.au CRICOS dataset (2026-02)
const MAJOR_INSTITUTIONS = [
  // Group of Eight (G8)
  { code: '00026A', name: 'University of Sydney', aliases: ['USyd', 'USYD'], state: 'NSW', type: 'University', city: 'Sydney', website: 'https://www.sydney.edu.au' },
  { code: '00098G', name: 'University of New South Wales', aliases: ['UNSW'], state: 'NSW', type: 'University', city: 'Sydney', website: 'https://www.unsw.edu.au' },
  { code: '00116K', name: 'University of Melbourne', aliases: ['UniMelb', 'UMelb'], state: 'VIC', type: 'University', city: 'Melbourne', website: 'https://www.unimelb.edu.au' },
  { code: '00008C', name: 'Monash University', aliases: ['Monash'], state: 'VIC', type: 'University', city: 'Melbourne', website: 'https://www.monash.edu.au' },
  { code: '00025B', name: 'University of Queensland', aliases: ['UQ'], state: 'QLD', type: 'University', city: 'Brisbane', website: 'https://www.uq.edu.au' },
  { code: '00120C', name: 'Australian National University', aliases: ['ANU'], state: 'ACT', type: 'University', city: 'Canberra', website: 'https://www.anu.edu.au' },
  { code: '00126G', name: 'University of Western Australia', aliases: ['UWA'], state: 'WA', type: 'University', city: 'Perth', website: 'https://www.uwa.edu.au' },
  { code: '00123M', name: 'University of Adelaide', aliases: ['UniAdelaide'], state: 'SA', type: 'University', city: 'Adelaide', website: 'https://www.adelaide.edu.au' },
  // ATN (Australian Technology Network)
  { code: '00099F', name: 'University of Technology Sydney', aliases: ['UTS'], state: 'NSW', type: 'University', city: 'Sydney', website: 'https://www.uts.edu.au' },
  { code: '00213J', name: 'Queensland University of Technology', aliases: ['QUT'], state: 'QLD', type: 'University', city: 'Brisbane', website: 'https://www.qut.edu.au' },
  { code: '00122A', name: 'RMIT University', aliases: ['RMIT'], state: 'VIC', type: 'University', city: 'Melbourne', website: 'https://www.rmit.edu.au' },
  { code: '00301J', name: 'Curtin University', aliases: ['Curtin'], state: 'WA', type: 'University', city: 'Perth', website: 'https://www.curtin.edu.au' },
  { code: '00002J', name: 'Macquarie University', aliases: ['MQ', 'Mac'], state: 'NSW', type: 'University', city: 'Sydney', website: 'https://www.mq.edu.au' },
  // Other major universities
  { code: '00113B', name: 'Deakin University', aliases: ['Deakin'], state: 'VIC', type: 'University', city: 'Melbourne/Geelong', website: 'https://www.deakin.edu.au' },
  { code: '00233E', name: 'Griffith University', aliases: ['Griffith'], state: 'QLD', type: 'University', city: 'Brisbane/Gold Coast', website: 'https://www.griffith.edu.au' },
  { code: '00917K', name: 'Western Sydney University', aliases: ['WSU', 'UWS'], state: 'NSW', type: 'University', city: 'Western Sydney', website: 'https://www.westernsydney.edu.au' },
  { code: '00102E', name: 'University of Wollongong', aliases: ['UoW', 'UOW'], state: 'NSW', type: 'University', city: 'Wollongong', website: 'https://www.uow.edu.au' },
  { code: '00586B', name: 'University of Tasmania', aliases: ['UTas', 'UTAS'], state: 'TAS', type: 'University', city: 'Hobart', website: 'https://www.utas.edu.au' },
  { code: '00115M', name: 'La Trobe University', aliases: ['LaTrobe'], state: 'VIC', type: 'University', city: 'Melbourne', website: 'https://www.latrobe.edu.au' },
  { code: '00111D', name: 'Swinburne University', aliases: ['Swinburne'], state: 'VIC', type: 'University', city: 'Melbourne', website: 'https://www.swinburne.edu.au' },
  { code: '00109J', name: 'University of Newcastle', aliases: ['UON', 'UNewcastle'], state: 'NSW', type: 'University', city: 'Newcastle', website: 'https://www.newcastle.edu.au' },
  { code: '00114A', name: 'Flinders University', aliases: ['Flinders'], state: 'SA', type: 'University', city: 'Adelaide', website: 'https://www.flinders.edu.au' },
  { code: '00124K', name: 'Victoria University', aliases: ['VU'], state: 'VIC', type: 'University', city: 'Melbourne', website: 'https://www.vu.edu.au' },
  { code: '03389E', name: 'Torrens University Australia', aliases: ['Torrens'], state: 'SA', type: 'University', city: 'Adelaide/Sydney/Melbourne', website: 'https://www.torrens.edu.au' },
  { code: '00117J', name: 'James Cook University', aliases: ['JCU'], state: 'QLD', type: 'University', city: 'Townsville/Cairns', website: 'https://www.jcu.edu.au' },
  { code: '00300K', name: 'Charles Darwin University', aliases: ['CDU'], state: 'NT', type: 'University', city: 'Darwin', website: 'https://www.cdu.edu.au' },
  { code: '00212K', name: 'University of Canberra', aliases: ['UC'], state: 'ACT', type: 'University', city: 'Canberra', website: 'https://www.canberra.edu.au' },
  { code: '01241G', name: 'Southern Cross University', aliases: ['SCU'], state: 'NSW', type: 'University', city: 'Lismore/Gold Coast', website: 'https://www.scu.edu.au' },
  { code: '00004G', name: 'Australian Catholic University', aliases: ['ACU'], state: 'NSW', type: 'University', city: 'Sydney/Melbourne/Brisbane/Canberra', website: 'https://www.acu.edu.au' },
  { code: '00017B', name: 'Bond University', aliases: ['Bond'], state: 'QLD', type: 'University', city: 'Gold Coast', website: 'https://www.bond.edu.au' },
  { code: '00279B', name: 'Edith Cowan University', aliases: ['ECU'], state: 'WA', type: 'University', city: 'Perth', website: 'https://www.ecu.edu.au' },
  { code: '00121B', name: 'University of South Australia', aliases: ['UniSA'], state: 'SA', type: 'University', city: 'Adelaide', website: 'https://www.unisa.edu.au' },
  { code: '00125J', name: 'Murdoch University', aliases: ['Murdoch'], state: 'WA', type: 'University', city: 'Perth', website: 'https://www.murdoch.edu.au' },
  { code: '00005F', name: 'Charles Sturt University', aliases: ['CSU'], state: 'NSW', type: 'University', city: 'Regional NSW/VIC', website: 'https://www.csu.edu.au' },
  { code: '00003G', name: 'University of New England', aliases: ['UNE'], state: 'NSW', type: 'University', city: 'Armidale', website: 'https://www.une.edu.au' },
  { code: '00219C', name: 'Central Queensland University', aliases: ['CQU', 'CQUniversity'], state: 'QLD', type: 'University', city: 'Rockhampton/Brisbane', website: 'https://www.cqu.edu.au' },
  { code: '00244B', name: 'University of Southern Queensland', aliases: ['USQ', 'UniSQ'], state: 'QLD', type: 'University', city: 'Toowoomba/Ipswich', website: 'https://www.usq.edu.au' },
  { code: '01595D', name: 'University of the Sunshine Coast', aliases: ['USC'], state: 'QLD', type: 'University', city: 'Maroochydore', website: 'https://www.usc.edu.au' },
  { code: '01032F', name: 'University of Notre Dame Australia', aliases: ['UNDA', 'Notre Dame'], state: 'WA', type: 'University', city: 'Fremantle/Sydney', website: 'https://www.nd.edu.au' },
  { code: '00103D', name: 'Federation University Australia', aliases: ['FedUni'], state: 'VIC', type: 'University', city: 'Ballarat/Gippsland', website: 'https://www.federation.edu.au' },
  // TAFE (principal registrations)
  { code: '00591E', name: 'TAFE NSW', state: 'NSW', type: 'TAFE', city: 'NSW statewide', website: 'https://www.tafensw.edu.au' },
  { code: '00021N', name: 'TAFE Queensland', state: 'QLD', type: 'TAFE', city: 'QLD statewide', website: 'https://tafeqld.edu.au' },
  { code: '00112C', name: 'TAFE Victoria (Learn Local)', state: 'VIC', type: 'TAFE', city: 'VIC statewide', website: 'https://www.skills.vic.gov.au' },
];

// ───── Field of study mappings ─────
const FIELD_MAP = {
  'it': 'Information Technology',
  'cs': 'Computer Science',
  'software': 'Software Engineering',
  'cyber': 'Cyber Security',
  '计算机': 'Information Technology',
  '编程': 'Computer Science',
  '网安': 'Cyber Security',
  '软件': 'Software Engineering',
  '商科': 'Business',
  'business': 'Business',
  'mba': 'Business Administration',
  '工程': 'Engineering',
  'engineering': 'Engineering',
  '会计': 'Accounting',
  'accounting': 'Accounting',
  'finance': 'Finance',
  '金融': 'Finance',
  '护理': 'Nursing',
  'nursing': 'Nursing',
  '医学': 'Medicine',
  'medicine': 'Medicine',
  '法律': 'Law',
  'law': 'Law',
  '教育': 'Education',
  '设计': 'Design',
  'design': 'Design',
  '建筑': 'Architecture',
  'architecture': 'Architecture',
  '数据': 'Data Science',
  'data': 'Data Science',
  'ai': 'Artificial Intelligence',
  '人工智能': 'Artificial Intelligence',
  'psychology': 'Psychology',
  '心理': 'Psychology',
  'social work': 'Social Work',
  '社工': 'Social Work',
  'marketing': 'Marketing',
  '市场': 'Marketing',
  'environment': 'Environmental Science',
  '环境': 'Environmental Science',
  'pharmacy': 'Pharmacy',
  '药': 'Pharmacy',
  'dentistry': 'Dentistry',
  '牙医': 'Dentistry',
  '口腔': 'Dentistry'
};

// AQF level keywords for detection
const AQF_VET_KEYWORDS = ['certificate i', 'certificate ii', 'certificate iii', 'certificate iv',
  'cert i', 'cert ii', 'cert iii', 'cert iv', 'diploma', 'advanced diploma',
  'vet', 'tafe', 'apprentice', 'traineeship', 'rto', 'vocational', '职业'];

function translateField(query) {
  const lower = query.toLowerCase().trim();
  for (const [key, val] of Object.entries(FIELD_MAP)) {
    if (lower.includes(key)) return val;
  }
  return query;
}

function lookupQSRanking(name) {
  return QS_RANKINGS[name] || null;
}

function findSubjectRankings(subject) {
  const lower = subject.toLowerCase();
  for (const [subjectName, data] of Object.entries(QS_BY_SUBJECT)) {
    if (subjectName.toLowerCase().includes(lower) ||
        lower.includes(subjectName.toLowerCase().split(' ')[0])) {
      return { subject: subjectName, ranking: data.ranking };
    }
  }
  return null;
}

// ───── searchCourses: CRICOS + QS + entry requirements ─────
export async function searchCourses(args) {
  const query = args.query || '';
  const mode = (args.mode || '').toLowerCase(); // 'qs', 'aqf', 'subject', 'entry'
  if (!query) return { error: 'Please provide a search query (university name, field of study, AQF level, or QS ranking)' };

  const lower = query.toLowerCase();

  // ── Mode: AQF level lookup ──
  if (mode === 'aqf' || lower.includes('aqf') || lower.includes('certificate') || lower.includes('diploma') ||
      AQF_VET_KEYWORDS.some(k => lower.includes(k))) {
    // Try to match a specific level
    let matchedLevel = null;
    for (const [level, info] of Object.entries(AQF_LEVELS)) {
      if (lower.includes(info.name.toLowerCase()) ||
          lower.includes('level ' + level) ||
          lower.includes('aqf ' + level) ||
          (lower.includes('cert') && lower.includes(level === '1' ? ' i' : level === '2' ? ' ii' : level === '3' ? ' iii' : level === '4' ? ' iv' : ''))) {
        matchedLevel = { level: parseInt(level), ...info };
        break;
      }
    }
    if (matchedLevel) {
      return {
        query,
        type: 'aqf_level',
        aqf: matchedLevel,
        training_search_url: `https://training.gov.au/Search?SearchRecordType=TrainingPackageQualification&SearchQuery=${encodeURIComponent(query)}`,
        note: matchedLevel.sector.includes('VET')
          ? 'VET qualifications are registered on training.gov.au (Australian Government)'
          : 'Higher Education qualifications are regulated by TEQSA'
      };
    }
    // Return full AQF framework
    return {
      query,
      type: 'aqf_framework',
      description: 'The Australian Qualifications Framework (AQF) sets standards for 10 levels of qualifications across VET and Higher Education sectors.',
      levels: AQF_LEVELS,
      vet_register: 'https://training.gov.au — VET qualifications (levels 1-6)',
      higher_ed_register: 'https://www.teqsa.gov.au/national-register — Higher Education (levels 7-10)',
      cricos_register: 'https://cricos.education.gov.au — International student courses',
      regulator_vet: 'ASQA (Australian Skills Quality Authority) or state equivalent',
      regulator_higher_ed: 'TEQSA (Tertiary Education Quality and Standards Agency)'
    };
  }

  // ── Mode: QS subject ranking lookup ──
  if (mode === 'subject' || mode === 'qs' || lower.includes('qs') || lower.includes('ranking') || lower.includes('排名')) {
    const subjectResult = findSubjectRankings(query);
    if (subjectResult) {
      return {
        type: 'qs_subject_ranking',
        subject: subjectResult.subject,
        year: '2024',
        top_australian_universities: subjectResult.ranking,
        source: 'QS World University Rankings by Subject 2024',
        official_url: 'https://www.topuniversities.com/university-subject-rankings'
      };
    }
    // Return all-discipline overview for Australian universities
    return {
      type: 'qs_australia_overview',
      year: '2025',
      top_10_australia: Object.entries(QS_RANKINGS)
        .sort((a, b) => a[1].qs_world - b[1].qs_world)
        .slice(0, 10)
        .map(([name, d]) => ({
          university: name,
          qs_world: d.qs_world,
          qs_australia: d.qs_aus,
          strengths: d.strengths
        })),
      subject_rankings: Object.keys(QS_BY_SUBJECT),
      source: 'QS World University Rankings 2025',
      official_url: 'https://www.topuniversities.com/world-university-rankings/2025',
      note: 'Rankings are updated annually; verify current year at topuniversities.com'
    };
  }

  // ── Specific university lookup ──
  const matchedInst = MAJOR_INSTITUTIONS.filter(inst => {
    const instLower = inst.name.toLowerCase();
    const codeMatch = inst.code.toLowerCase() === lower.replace(/\s/g, '');
    const aliasMatch = (inst.aliases || []).some(a => lower.includes(a.toLowerCase()) || a.toLowerCase() === lower);
    return instLower.includes(lower) ||
      codeMatch ||
      lower.includes(instLower) ||
      aliasMatch ||
      // Word matching: "Sydney" matches "University of Sydney"
      instLower.split(' ').some(w => w.length > 4 && lower.includes(w));
  });

  if (matchedInst.length > 0) {
    const results = matchedInst.map(inst => {
      const qs = lookupQSRanking(inst.name);
      return {
        cricos_code: inst.code,
        name: inst.name,
        state: inst.state,
        city: inst.city,
        type: inst.type,
        website: inst.website,
        cricos_url: `https://cricos.education.gov.au/Institution/InstitutionDetails.aspx?ProviderCode=${inst.code}`,
        ...(qs ? {
          qs_world_rank_2025: qs.qs_world,
          qs_australia_rank_2025: qs.qs_aus,
          key_strengths: qs.strengths,
          top_qs_subjects: qs.top_subjects,
          research_focus: qs.research_focus,
          era_rating: qs.era_rating,
          intl_student_percentage: qs.intl_student_pct
        } : {})
      };
    });

    return {
      query,
      type: 'institution_lookup',
      results,
      count: matchedInst.length,
      entry_requirements_note: 'For ATAR cutoffs and subject prerequisites visit: https://www.courseseeker.edu.au',
      course_fees_note: 'International tuition fees: typically AUD $28,000–$55,000/year for postgrad. Check CRICOS or university directly.',
      qs_source: 'QS World University Rankings 2025 (topuniversities.com)',
      qs_last_updated: '2024 (ranking published for 2025)'
    };
  }

  // ── Field of study search ──
  const field = translateField(query);
  const subjectRanking = findSubjectRankings(field);

  return {
    query,
    type: 'field_search',
    field,
    qs_subject_ranking: subjectRanking || 'Use mode:"subject" with a subject name to get QS rankings',
    top_universities: MAJOR_INSTITUTIONS
      .filter(i => i.type === 'University')
      .slice(0, 8)
      .map(i => {
        const qs = lookupQSRanking(i.name);
        return { name: i.name, state: i.state, qs_world: qs?.qs_world || 'n/a' };
      }),
    cricos_search_url: `https://cricos.education.gov.au/Course/CourseSearch.aspx?CourseField=${encodeURIComponent(field)}`,
    entry_scores_url: `https://www.courseseeker.edu.au/course-search?keyword=${encodeURIComponent(field)}`,
    aqf_info: field.toLowerCase().includes('certificate') || field.toLowerCase().includes('diploma')
      ? AQF_LEVELS
      : { note: 'Use mode:"aqf" to see Australian Qualifications Framework levels 1-10' }
  };
}

// ───── getAQFInfo: standalone AQF level reference ─────
export function getAQFInfo(args) {
  const level = args.level ? parseInt(args.level) : null;
  if (level && AQF_LEVELS[level]) {
    return {
      type: 'aqf_level',
      aqf: { level, ...AQF_LEVELS[level] },
      training_gov: level <= 6
        ? 'https://training.gov.au — search VET qualifications'
        : 'https://www.teqsa.gov.au/national-register — Higher Education providers',
      cricos: 'https://cricos.education.gov.au — for international student courses'
    };
  }
  return {
    type: 'aqf_full_framework',
    levels: AQF_LEVELS,
    vet_register: 'https://training.gov.au',
    he_register: 'https://www.teqsa.gov.au/national-register',
    cricos: 'https://cricos.education.gov.au'
  };
}
