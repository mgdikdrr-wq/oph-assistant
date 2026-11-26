/* My Ophthalmology Assistant — medical option lists & static data.
   All lists are editable from Settings; these are the factory defaults. */
(function () {
  const D = {};

  D.VA_OPTIONS = ['6/6','6/9','6/12','6/18','6/24','6/36','6/60','5/60','4/60','3/60','2/60','1/60','CF','HM','PL','NPL'];
  D.IOP_METHODS = ['Air puff','GAT','Perkins','iCare','Schiotz'];
  D.REF_TYPES = ['Autorefraction','Subjective'];
  D.LENS_GRADES = ['I','II','III','IV'];

  D.DEFAULT_OPTIONS = {
    complaint: ['Diminution of vision (DOV)','Blurring of vision','Redness','Pain','Itching','Watering','Discharge','Photophobia','Floaters','Flashes','Diplopia','Foreign body sensation','Glare','Other'],
    pastHistory: ['Phaco','ECCE','SICS','IVI','Laser','YAG capsulotomy','Glaucoma surgery','Trauma','Previous ocular surgery','No relevant history','Other'],
    systemic: ['DM','HTN','Cardiac disease','CKD','Asthma','Thyroid disease','Liver disease','Neurological disease','Other'], // "Free" handled as exclusive toggle
    generalFeatures: ['Normal','Abnormal','Other'],
    lidConj: ['Normal','Blepharitis','MGD','Ptosis','Entropion','Ectropion','Trichiasis','Chalazion','Conjunctival congestion','Pterygium','Pinguecula','Follicles','Papillae','Other'],
    cornea: ['Clear','Edema','Scar','Opacity','Nebula','Macula','Leucoma','SPK','Abrasion','Ulcer','KP','Arcus','Dystrophy','Degeneration','Other'],
    antChamber: ['Deep','Formed','Shallow','Flat','Quiet','Cells','Flare','Hyphema','Hypopyon','Other'],
    pupilIris: ['RRR','Round','Regular','Reactive','RAPD','Irregular pupil','Fixed pupil','Posterior synechiae','NVI','Iris atrophy','Pseudoexfoliation','Poor dilation','Other'],
    lens: ['Clear lens','Nuclear cataract','Cortical cataract','PSC','Mature cataract','Hypermature cataract','White cataract','Brown cataract','Brunescent cataract','Intumescent cataract','PCIOL','ACIOL','Aphakia','PCO','Subluxated lens','Other'],
    plp: ['PL','NPL','Projection accurate','Projection inaccurate','Projection in four quadrants','Not assessed','Other'],
    fundus: ['Normal fundus','No view','Hazy view','NPDR','PDR','DME','AMD','Myopic fundus','BRVO','CRVO','Retinal detachment','Macular scar','Optic atrophy','Glaucomatous disc','Other'],
    orbitEom: ['Full free movements','Restricted movement','Proptosis','Enophthalmos','Squint','Diplopia','Other'],
    diagnosis: ['Senile cataract','Nuclear cataract','PSC','Cortical cataract','Mature cataract','Pterygium','DME','Wet AMD','BRVO','CRVO','CNV','PDR','Other'],
    investigations: ['Biometry','IOL Master','A-scan','B-scan','OCT Macula','OCT RNFL','FFA','Visual field','Fundus photography','Pachymetry','Pentacam','CBC','RBS','HbA1c','HCV','HBV','Other'],
    operations: ['Phaco','Pterygium excision','IVI Anti-VEGF']
  };

  // Lens findings that accept a clinical grade (I–IV).
  D.LENS_GRADABLE = ['Nuclear cataract','Cortical cataract','PSC'];
  // Short tokens used to compose the lens text (e.g. "N III Brown + PSC II").
  D.LENS_TOKENS = { 'Nuclear cataract':'N', 'Cortical cataract':'Cortical', 'PSC':'PSC' };

  D.VIRAL_OPTIONS = ['+ve','-ve','Pending','Not available'];

  D.COMPLAINT_EYES = ['OD','OS','OU'];
  D.ONSET = ['Sudden','Gradual'];
  D.PROGRESSION = ['Progressive','Stationary','Regressing'];

  D.EXAM_SECTIONS = [
    { key:'generalFeatures', en:'General Features',            ar:'السمات العامة' },
    { key:'visionIop',       en:'Aided Vision & IOP',          ar:'النظر وضغط العين' },
    { key:'refraction',      en:'Refraction',                  ar:'الانكسار' },
    { key:'lidConj',         en:'Lid & Conjunctiva',           ar:'الأجفان والملتحمة' },
    { key:'cornea',          en:'Cornea',                      ar:'القرنية' },
    { key:'antChamber',      en:'Anterior Chamber',            ar:'الحجرة الأمامية' },
    { key:'pupilIris',       en:'Pupil & Iris',                ar:'الحدقة والقزحية' },
    { key:'lens',            en:'Lens',                        ar:'العدسة' },
    { key:'plp',             en:'Light Perception & Projection', ar:'الإحساس الضوئي والإسقاط' },
    { key:'fundus',          en:'Fundus',                      ar:'قاع العين' },
    { key:'orbitEom',        en:'Orbit & Extra Ocular Muscles',ar:'المحجر وعضلات العين' }
  ];

  D.STATUS = {
    draft:     { ar:'مسودة',            en:'Draft' },
    incomplete:{ ar:'غير مكتملة',        en:'Incomplete' },
    ready:     { ar:'جاهزة للمراجعة',    en:'Ready for review' },
    completed: { ar:'مكتملة التحضير',    en:'Preparation completed' }
  };

  D.DEFAULT_SETTINGS = {
    doctorName: 'د/ مجدي الخضور',
    hospitalName: 'مستشفى رمد المحلة الكبرى',
    fontScale: 1,          // 0.85 – 1.4
    darkMode: false,
    exportDpi: 300,        // 300 or 600
    autoLockMinutes: 5,    // 0 = off
    passcodeHash: '',      // SHA-256 hex of passcode; empty = no lock
    favoriteDrugs: [],
    options: null          // null → use DEFAULT_OPTIONS; otherwise overrides
  };

  window.OPH_DATA = D;
})();
