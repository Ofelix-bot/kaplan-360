"""Build data/raw/compass-top-tier.json from MOM's COMPASS C2 top-tier list.

Source: Ministry of Manpower, "List of institutions awarded 20 points under
COMPASS Criterion 2 (Qualifications)", released November 2025, applicable to
new and renewal EP applications from 1 January 2026.
Official PDF (kept at data/sources/mom/compass-c2-top-tier.pdf):
https://www.mom.gov.sg/-/media/mom/documents/work-passes-and-permits/compass/compass-c2-list-of-top-tier-institutions.pdf

The PDF's tables use merged cells (one faculty cell spans several Group B
institutions, and the MBA cell runs across a page break), so the list below is
transcribed by hand from the rendered pages. The script then checks every
transcribed institution name against the PDF's extracted text, so a typo or a
row that is not in the PDF fails the build.

Institution matching is exact identity only: a listed name is matched against
names in data/raw/institutions.json (the roster; every programmes.json
institutionId is in it) after accent/punctuation normalisation, within the
same country. Roster duplicates of the same institution (QS + Kaggle rows) all
get the entry. Campuses, colleges and "University of X" vs "X University" are
never fuzzy-matched; hand-checked ids go in IDS below.

Run:  python -I scripts/data/compass-top-tier.py
Needs pypdf (python -m pip install --user pypdf). Under -I the user site is not
on sys.path, so it is appended explicitly below.
"""

import json
import re
import site
import sys
import unicodedata
from pathlib import Path

try:
    import pypdf
except ImportError:  # -I drops the user site; pypdf lives there
    sys.path.append(site.getusersitepackages())
    import pypdf

ROOT = Path(__file__).resolve().parents[2]
PDF = ROOT / "data/sources/mom/compass-c2-top-tier.pdf"
ROSTER = ROOT / "data/raw/institutions.json"
PROGRAMMES = ROOT / "data/raw/programmes.json"
OUT = ROOT / "data/raw/compass-top-tier.json"

SOURCE = {
    "url": "https://www.mom.gov.sg/-/media/mom/documents/work-passes-and-permits/compass/compass-c2-list-of-top-tier-institutions.pdf",
    "title": "COMPASS C2 list of top-tier institutions",
    "effective": "2026-01-01",
    "published": "Released in November 2025",
    "retrievedAt": "2026-11-02",
}

# ---------------------------------------------------------------------------
# Group A: 20 points for all faculties.
# (printed name, country as printed, [constituent bullets as printed])
# ---------------------------------------------------------------------------
GROUP_A = [
    ("Boston University", "United States of America", []),
    ("Brown University", "United States of America", []),
    ("California Institute of Technology", "United States of America", []),
    ("Carnegie Mellon University", "United States of America", []),
    ("Chulalongkorn University", "Thailand", []),
    ("City University of Hong Kong", "Hong Kong", []),
    ("Columbia University", "United States of America", []),
    ("Cornell University", "United States of America", []),
    ("Dai Hoc Duy Tan (Duy Tan University)", "Vietnam", []),
    ("Duke University", "United States of America", []),
    ("Ecole Polytechnique Federale De Lausanne (EPFL)(Swiss Federal Institute Of Technology Lausanne)", "Switzerland", []),
    ("Eidgenossische Technische Hochschule Zurich (ETH Zurich) (Swiss Federal Institute Of Technology Zurich)", "Switzerland", []),
    ("Freie Universitat Berlin", "Germany", []),
    ("Fudan University", "China", []),
    ("Harvard University", "United States of America", []),
    ("Hong Kong University of Science and Technology (HKUST)", "Hong Kong", []),
    ("Imperial College of Science, Technology and Medicine (Imperial College London)", "United Kingdom", []),
    ("Indian Institute of Technology Bombay", "India", []),
    ("Indian Institute of Technology Delhi", "India", []),
    ("Institut Polytechnique de Paris (Polytechnic Institute of Paris)", "France", [
        "Institut Mines-Telecom - Ecole Nationale Superieure Des Telecommunications (Telecom Paris) (Telecom Paristech)",
        "Institut Mines-Telecom - Telecom SudParis",
        "Ecole Polytechnique",
        "Groupe des Ecoles Nationales d'Economie et Statistique - Ecole Nationale de la Statistique et de l'Administration Economique (ENSAE)",
        "Ecole Nationale Superieure De Techniques Avancees (ENSTA Paris)",
    ]),
    ("Johns Hopkins University", "United States of America", []),
    ("Karlsruher Institut Fur Technologie (Karlsruhe Institute of Technology)", "Germany", []),
    ("Katholieke Universiteit Leuven (KU Leuven)", "Belgium", []),
    ("Keio University", "Japan", []),
    ("King Fahd University of Petroleum and Minerals", "Saudi Arabia", []),
    ("King's College London", "United Kingdom", []),
    ("Korea Advanced Institute of Science and Technology (KAIST)", "South Korea", []),
    ("Korea University", "South Korea", []),
    ("Kungliga Tekniska Hogskolan (KTH Royal Institute Of Technology)", "Sweden", []),
    ("Kyoto University", "Japan", []),
    ("Lasalle College of the Arts", "Singapore", []),
    ("Leland Stanford Junior University (Stanford University)", "United States of America", []),
    ("Lomonosov Moscow State University", "Russia", []),
    ("Ludwig-Maximilians-Universitat Munchen", "Germany", []),
    ("Lunds Universitet (Lund University)", "Sweden", []),
    ("Massachusetts Institute of Technology", "United States of America", []),
    ("McGill University", "Canada", []),
    ("Monash University", "Australia", []),
    ("Nanyang Academy Of Fine Arts (NAFA)", "Singapore", []),
    ("Nanyang Technological University (NTU)", "Singapore", [
        "National Institute of Education (NIE)",
        "Technical University of Munich (TUM) And Nanyang Technological University (NTU)",
    ]),
    ("National Cheng Kung University", "Taiwan", []),
    ("National Taiwan University", "Taiwan", []),
    ("National Tsing Hua University", "Taiwan", []),
    ("National University Of Singapore (NUS)", "Singapore", [
        "Yale NUS College of The National University of Singapore",
        "Duke-NUS Medical School",
    ]),
    ("New York University", "United States of America", []),
    ("Northwestern University", "United States of America", []),
    ("Osaka University", "Japan", []),
    ("Peking University", "China", []),
    ("Pohang University of Science and Technology (POSTECH)", "South Korea", []),
    ("Politecnico Di Milano", "Italy", []),
    ("Pontificia Universidad Catolica De Chile (Pontifical Catholic University Of Chile or PUC)", "Chile", []),
    ("Princeton University", "United States of America", []),
    ("Purdue University, West Lafayette", "United States of America", [
        "Purdue University, North Central",
        "Purdue University, Calumet",
        "Purdue University, Fort Wayne",
        "Purdue University, Northwest",
    ]),
    ("Ruprecht-Karls-Universitat Heidelberg (Heidelberg University)", "Germany", []),
    ("Rheinisch-Westfalische Technische Hochschule Aachen (RWTH Aachen University)", "Germany", []),
    ("Seoul National University", "South Korea", []),
    ("Shanghai Jiao Tong University", "China", []),
    ("Singapore Institute Of Technology (SIT)", "Singapore", []),
    ("Singapore Management University (SMU)", "Singapore", []),
    ("Singapore University Of Social Sciences (SUSS)", "Singapore", []),
    ("Singapore University Of Technology And Design (SUTD)", "Singapore", []),
    ("Sorbonne Universite (Sorbonne University)", "France", []),
    ("Technische Universitat Munchen (Technical University of Munich)", "Germany", []),
    ("Technische Universiteit Delft (Delft University of Technology)", "Netherlands", []),
    ("The Australian National University", "Australia", []),
    ("The Chinese University of Hong Kong", "Hong Kong", []),
    ("The Hong Kong Polytechnic University", "Hong Kong", []),
    ("The London School of Economics and Political Science (LSE)", "United Kingdom", []),
    ("The Pennsylvania State University", "United States of America", []),
    ("The University of Adelaide", "Australia", []),
    ("The University of Edinburgh", "United Kingdom", []),
    ("The University of Hong Kong", "Hong Kong", []),
    ("The University of Leeds", "United Kingdom", []),
    ("The University of Manchester", "United Kingdom", []),
    ("The University of Melbourne", "Australia", []),
    ("The University of New South Wales (UNSW Sydney)", "Australia", []),
    ("The University of Queensland", "Australia", []),
    ("The University of Sheffield", "United Kingdom", []),
    ("The University of Sydney", "Australia", []),
    ("The University of Texas at Austin", "United States of America", []),
    ("The University of Tokyo", "Japan", []),
    ("The University of Warwick", "United Kingdom", []),
    ("The University of Western Australia", "Australia", []),
    ("Tohoku University", "Japan", []),
    ("Tokyo Institute of Technology", "Japan", []),
    ("Trinity College Dublin, the University of Dublin", "Ireland", []),
    ("Tsinghua University", "China", []),
    ("Universidad de Buenos Aires (University of Buenos Aires)", "Argentina", []),
    ("Universidad Nacional Autonoma De Mexico (National Autonomous University of Mexico)", "Mexico", []),
    ("Universidade De Sao Paulo (University of Sao Paulo)(USP)", "Brazil", []),
    ("Universitas Indonesia (University of Indonesia)", "Indonesia", []),
    ("Universitat Zurich (University of Zurich)", "Switzerland", []),
    ("Universite De Recherche Paris Sciences & Lettres - PSL Research University (Universite Paris Sciences Et Lettres - Universite PSL)", "France", [
        "Chimie Paristech",
        "Ecole Nationale Des Chartes",
        "Ecole Normale Superieure (ENS)",
        "Ecole Pratique Des Hautes Etudes (EPHE)",
        "Espci Paris, Institut Curie",
        "Ecole Nationale Superieure Des Mines De Paris (Mines Paristech)",
        "Observatoire De Paris",
        "Conservatoire National Superieur D'Art Dramatique",
        "Universite Paris-Dauphine (PSL Research University) (Universite Paris IX)",
    ]),
    ("Universite Paris-Saclay", "France", [
        "Instituts Universitaires Technologiques De Cachan",
        "Instituts Universitaires Technologiques D'Orsay",
        "Instituts Universitaires Technologiques De Sceaux",
        "Polytech Paris-Saclay",
        "Centralesupelec - Ecole Centrale Des Arts Et Manufactures",
        "Institut National Des Sciences Et Industries Du Vivant Et De L'Environnement (Agroparistech)",
        "Ecole Normale Superieure Paris-Saclay (ENS Paris-Saclay)",
        "Ecole Superieure D'Optique (Supoptique or Institut D'Optique Graduate School)",
    ]),
    ("Universiteit van Amsterdam (University of Amsterdam)", "Netherlands", []),
    ("Universiti Brunei Darussalam", "Brunei", []),
    ("Universiti Kebangsaan Malaysia (UKM) (National University Of Malaysia)", "Malaysia", []),
    ("Universiti Malaya (The University of Malaya)", "Malaysia", []),
    ("Universiti Putra Malaysia (UPM)", "Malaysia", []),
    ("Universiti Sains Malaysia (USM)", "Malaysia", []),
    ("Universiti Teknologi Malaysia (UTM)", "Malaysia", []),
    ("University College London (UCL)", "United Kingdom", []),
    ("University of Alberta", "Canada", []),
    ("University of Auckland", "New Zealand", []),
    ("University of Birmingham", "United Kingdom", []),
    ("University of Bristol", "United Kingdom", []),
    ("University of British Columbia", "Canada", []),
    ("University of California, Berkeley", "United States of America", []),
    ("University of California, Los Angeles", "United States of America", []),
    ("University of California, San Diego", "United States of America", []),
    ("University of Cambridge", "United Kingdom", []),
    ("University of Chicago", "United States of America", []),
    ("Kobenhavns Universitet (University of Copenhagen)", "Denmark", []),
    ("University of Durham (Durham University)", "United Kingdom", []),
    ("University of Glasgow", "United Kingdom", []),
    ("University of Illinois, Urbana - Champaign", "United States of America", []),
    ("University of Michigan, Ann Arbor", "United States of America", []),
    ("University of Nottingham", "United Kingdom", []),
    ("University of Oxford", "United Kingdom", []),
    ("University of Pennsylvania", "United States of America", []),
    ("University of Southampton", "United Kingdom", []),
    ("University of Technology Sydney", "Australia", []),
    ("University of the Arts Singapore (UAS)", "Singapore", []),
    ("University of the Philippines", "Philippines", [
        "University of The Philippines - Open University",
        "University of The Philippines Baguio",
        "University of The Philippines Cebu",
        "University of The Philippines Diliman (UPD)",
        "University of The Philippines Los Banos (UPLB)",
        "University of The Philippines Manila",
        "University of The Philippines Mindanao",
        "University of The Philippines Visayas",
    ]),
    ("University of Toronto", "Canada", []),
    ("University of Washington", "United States of America", []),
    ("Uppsala Universitet", "Sweden", []),
    ("Waseda University", "Japan", []),
    ("Yale University", "United States of America", []),
    ("Yonsei University", "South Korea", []),
    ("Zhejiang University", "China", []),
]

# ---------------------------------------------------------------------------
# Group B faculty -> our 13 disciplines, mapped by hand (conservative).
# Our disciplines: business, accounting-finance, marketing, ai-data, it,
# education, psychology-counselling, healthcare-nursing, law-criminology,
# communication, sports-science, construction, hospitality-tourism.
#
# | Faculty as printed                         | Disciplines                              | Why
# |--------------------------------------------|------------------------------------------|------------------------------------------
# | Business Administration (MBA, master's)    | business                                 | MBA = general business administration
# | Business Administration (master's+)        | business                                 | INSEAD; same reading as MBA
# | Management                                 | business                                 |
# | Finance                                    | accounting-finance                       |
# | Change                                     | business                                 | INSEAD Executive Master in Change (organisational change)
# | Accounting                                 | accounting-finance                       |
# | Economics                                  | (none)                                   | economics is not one of the 13
# | Business                                   | business, accounting-finance, marketing  | whole business school (HSG)
# | Environmental Sciences / Biomedical Sci.   | (none)                                   | sciences, not in the 13
# | Design / Furniture Design / Fashion Studies| (none)                                   | art & design, not in the 13
# | Politics and International Studies         | (none)                                   |
# | Culinary Skills, Hospitality Management,   | hospitality-tourism                      | EHL hospitality/tourism school
# |   Hotel Management, Pastry & Baking,       |                                          |
# |   Tourism Management, Tourism Studies      |                                          |
# | Pharmacy (DPhil only)                      | (none)                                   | pharmacy doctorate; not nursing/allied health
# | Food/agri/plant/animal/aquaculture faculties| (none)                                  | life sciences, not in the 13
# | Clinical Nutrition                         | (none)                                   | nutrition science; kept out (conservative)
# | Veterinary Medicine                        | (none)                                   |
# | Computer Science                           | it, ai-data                              | computing
# | Information Technology                     | it                                       |
# | Programming & Systems Analysis             | it                                       |
# | Science (Computer Studies)                 | it, ai-data                              | computing
# | Engineering / Environmental Engineering /  | (none)                                   | engineering, not construction
# |   Ocean, Marine, Naval, Maritime, Offshore |                                          |
# |   Wind, Logistics Engineering              |                                          |
# | Biological Sciences / Advanced Biotech.    | (none)                                   |
# | Ocean Science and Engineering              | (none)                                   |
# | Maritime Law                               | law-criminology                          | law
# ---------------------------------------------------------------------------
D = {
    "Business Administration (for MBAs - master's degrees)": ["business"],
    "Business Administration (master's degree and above)": ["business"],
    "Management (master's degree and above)": ["business"],
    "Finance (master's degree and above)": ["accounting-finance"],
    "Change (master's degree and above)": ["business"],
    "Accounting": ["accounting-finance"],
    "Finance": ["accounting-finance"],
    "Economics": [],
    "Business": ["business", "accounting-finance", "marketing"],
    "Environmental Sciences": [],
    "Biomedical Sciences": [],
    "Design": [],
    "Politics and International Studies": [],
    "Culinary Skills": ["hospitality-tourism"],
    "Hospitality Management": ["hospitality-tourism"],
    "Hotel Management": ["hospitality-tourism"],
    "Pastry & Baking": ["hospitality-tourism"],
    "Tourism Management": ["hospitality-tourism"],
    "Tourism Studies": ["hospitality-tourism"],
    "Furniture Design": [],
    "Fashion Studies": [],
    "Pharmacy (DPhil only)": [],
    "Food Science and Technology": [],
    "Aquaculture and Marine Resource Management": [],
    "Plant Biotechnology": [],
    "Plant Breeding": [],
    "Resilient Farming and Food Systems": [],
    "Agriculture and Environmental Technology": [],
    "Animal Biology": [],
    "Animal Science": [],
    "Animal Science and Management": [],
    "Biotechnology": [],
    "Clinical Nutrition": [],
    "Entomology": [],
    "Global Disease Biology": [],
    "International Agriculture Development": [],
    "Plant Sciences": [],
    "Sustainable Agriculture and Food Systems": [],
    "Veterinary Medicine": [],
    "Computer Science": ["it", "ai-data"],
    "Biological Sciences": [],
    "Engineering": [],
    "Environmental Engineering": [],
    "Advanced Biotechnology": [],
    "Information Technology": ["it"],
    "Programming & Systems Analysis": ["it"],
    "Science (Computer Studies)": ["it", "ai-data"],
    "Ocean Engineering and Technology": [],
    "Offshore Wind Energy Engineering": [],
    "Marine Technology": [],
    "Naval Architecture": [],
    "Ocean Engineering": [],
    "Marine Engineering": [],
    "Offshore Wind Energy": [],
    "Maritime Engineering": [],
    "Logistics Engineering": [],
    "Ocean Science and Engineering": [],
    "Maritime Law": ["law-criminology"],
}

MBA = (["Business Administration (for MBAs - master's degrees)"], "EDB")
COMPUTING = ["Computer Science", "Information Technology", "Programming & Systems Analysis", "Science (Computer Studies)"]
MARITIME = ["Logistics Engineering", "Ocean Science and Engineering", "Maritime Law"]

# Group B: (printed name, country, [faculties], agency). Merged cells in the
# PDF are expanded: the MBA cell covers HEC..LBS (it continues onto page 7);
# the computing cell covers VNU HCMC..Gadjah Mada with IMDA/MAS except ITB
# (EDB); the maritime cell covers Shanghai and Dalian Maritime.
GROUP_B = [
    ("Ecole Des Hautes Etudes Commerciales (HEC Paris)", "France", *MBA),
    ("ESSEC Business School", "France", *MBA),
    ("Iese Business School", "Spain", *MBA),
    ("Indian Institute of Management Ahmedabad", "India", *MBA),
    ("Indian Institute of Management Bangalore", "India", *MBA),
    ("Indian Institute of Management Calcutta", "India", *MBA),
    ("Instituto De Empresa (IE Business School)", "Spain", *MBA),
    ("International Institute for Management Development (IMD)", "Switzerland", *MBA),
    ("University of London, London Business School", "United Kingdom", *MBA),
    ("INSEAD (Institut Europeen D'Administration Des Affaires)", "France",
     ["Business Administration (master's degree and above)", "Management (master's degree and above)",
      "Finance (master's degree and above)", "Change (master's degree and above)"], "EDB"),
    ("Die Universitat St. Gallen (The University of St. Gallen)", "Switzerland",
     ["Accounting", "Finance", "Economics", "Business"], "EDB"),
    ("Universidad de Barcelona", "Spain", ["Economics", "Environmental Sciences", "Biomedical Sciences"], "EDB"),
    ("Aalto-Yliopisto (Aalto University)", "Finland", ["Design"], "EDB"),
    ("Sciences Po", "France", ["Politics and International Studies"], "EDB"),
    ("Ecole Hoteliere De Lausanne (EHL Hospitality Business School)", "Switzerland",
     ["Culinary Skills", "Hospitality Management", "Hotel Management", "Pastry & Baking",
      "Tourism Management", "Tourism Studies"], "STB"),
    ("Rhode Island School of Design", "United States of America", ["Furniture Design"], "ESG"),
    ("University of the Arts, London", "United Kingdom", ["Fashion Studies"], "ESG"),
    ("University of North Carolina at Chapel Hill", "United States of America", ["Pharmacy (DPhil only)"], "MOH"),
    ("Wageningen University & Research", "Netherlands",
     ["Food Science and Technology", "Aquaculture and Marine Resource Management", "Plant Biotechnology",
      "Plant Breeding", "Resilient Farming and Food Systems"], "ESG"),
    ("University of California, Davis", "United States",
     ["Food Science and Technology", "Agriculture and Environmental Technology", "Animal Biology",
      "Animal Science", "Animal Science and Management", "Biotechnology", "Clinical Nutrition", "Entomology",
      "Global Disease Biology", "International Agriculture Development", "Plant Sciences",
      "Sustainable Agriculture and Food Systems"], "ESG"),
    ("Royal Veterinary College (of University of London)", "United Kingdom", ["Veterinary Medicine"], "STB"),
    ("Aarhus Universitet (Aarhus University)", "Denmark", ["Computer Science", "Biological Sciences"], "EDB"),
    ("Universidad De Bologna", "Italy", ["Computer Science", "Engineering"], "EDB"),
    ("Universitat Autonoma De Barcelona", "Spain",
     ["Computer Science", "Environmental Engineering", "Advanced Biotechnology"], "EDB"),
    ("Dai Hoc Quoc Gia Thanh Pho Ho Chi Minh (Vietnam National University, Ho Chi Minh City)", "Vietnam", COMPUTING, "IMDA, MAS"),
    ("Dai Hoc Quoc Gia Ha Noi (Vietnam National University, Hanoi)", "Vietnam", COMPUTING, "IMDA, MAS"),
    ("Indian Institute of Science, Bangalore", "India", COMPUTING, "IMDA, MAS"),
    ("Indian Institute of Technology Guwahati", "India", COMPUTING, "IMDA, MAS"),
    ("Indian Institute of Technology Kanpur", "India", COMPUTING, "IMDA, MAS"),
    ("Indian Institute of Technology Kharagpur", "India", COMPUTING, "IMDA, MAS"),
    ("Indian Institute of Technology Madras", "India", COMPUTING, "IMDA, MAS"),
    ("Indian Institute of Technology Roorkee", "India", COMPUTING, "IMDA, MAS"),
    ("Institut Teknologi Bandung", "Indonesia", COMPUTING, "EDB"),
    ("Universitas Gadjah Mada (Gadjah Mada University)", "Indonesia", COMPUTING, "IMDA, MAS"),
    ("National Taiwan Ocean University", "Taiwan", ["Ocean Engineering and Technology"], "ESG"),
    ("Tufts University", "United States", ["Offshore Wind Energy Engineering"], "ESG"),
    ("Norwegian University of Science and Technology", "Norway", ["Marine Technology"], "ESG"),
    ("Harbin Engineering University", "China", ["Naval Architecture", "Ocean Engineering"], "ESG"),
    ("University of Strathclyde", "United Kingdom", ["Naval Architecture", "Marine Engineering", "Offshore Wind Energy"], "ESG"),
    ("University of Newcastle Upon Tyne (Newcastle University)", "United Kingdom",
     ["Naval Architecture", "Marine Engineering", "Maritime Engineering"], "ESG"),
    ("Shanghai Maritime University", "China", MARITIME, "MOT"),
    ("Dalian Maritime University", "China", MARITIME, "MOT"),
]

# Hand-checked roster ids where the normalised-name match misses or must be
# pinned. Key = printed name (main row or constituent bullet). An empty list
# means "checked: not in our roster" (still reported as unmatched).
#
# The University of Adelaide -> adelaide-university: merged with UniSA into Adelaide University on 2026-01-01;
#   the list names the pre-merger body, counted for its successor (the user's decision, 2026-11-02: the newest stands).
# Deliberately NOT mapped (not the same legal institution):
#   Tokyo Institute of Technology -> institute-of-science-tokyo (2024 merger)
#   CentraleSupelec -> ecole-centrale-paris (2015 merger)
#   Instituto De Empresa (IE Business School) -> ie-university (a school of it)
#   University of London, London Business School: not in the roster
IDS = {
    "Ecole Polytechnique Federale De Lausanne (EPFL)(Swiss Federal Institute Of Technology Lausanne)": [
        "ecole-polytechnique-federale-de-lausanne", "swiss-federal-institute-of-technology-lausanne",
        "swiss-federal-institute-of-technology-in-lausanne", "swiss-federal-institute-of-technology-of-lausanne"],
    "Eidgenossische Technische Hochschule Zurich (ETH Zurich) (Swiss Federal Institute Of Technology Zurich)": [
        "eth-zurich-swiss-federal-institute-of-technology", "swiss-federal-institute-of-technology-zurich"],
    "Freie Universitat Berlin": ["freie-universitaet-berlin"],
    "Imperial College of Science, Technology and Medicine (Imperial College London)": [
        "imperial-college-london", "imperial-college-of-science-technology-and-medicine"],
    "Karlsruher Institut Fur Technologie (Karlsruhe Institute of Technology)": ["kit-karlsruhe-institute-of-technology"],
    "Katholieke Universiteit Leuven (KU Leuven)": [
        "katholieke-universiteit-leuven", "ku-leuven", "catholic-university-of-leuven"],
    "Korea Advanced Institute of Science and Technology (KAIST)": ["kaist-korea-advanced-institute-of-science-and-technology"],
    "Leland Stanford Junior University (Stanford University)": ["stanford-university"],
    "Lomonosov Moscow State University": ["lomonosov-moscow-state-university", "moscow-state-university"],
    "Ludwig-Maximilians-Universitat Munchen": [
        "ludwig-maximilians-universitat-munchen", "lmu-munich", "ludwig-maximilian-university-of-munich",
        "university-of-munich"],
    "Nanyang Technological University (NTU)": ["nanyang-technological-university-singapore"],
    "Politecnico Di Milano": ["politecnico-di-milano", "polytechnic-institute-of-milan", "polytechnic-university-of-milan"],
    "Pontificia Universidad Catolica De Chile (Pontifical Catholic University Of Chile or PUC)": [
        "pontificia-universidad-catolica-de-chile", "pontifical-catholic-university-of-chile",
        "catholic-university-of-chile"],
    "Purdue University, West Lafayette": ["purdue-university", "purdue-university-west-lafayette"],
    "Ruprecht-Karls-Universitat Heidelberg (Heidelberg University)": [
        "heidelberg-university", "ruprecht-karls-universitat-heidelberg", "ruprecht-karl-university-of-heidelberg",
        "university-of-heidelberg"],
    "Technische Universitat Munchen (Technical University of Munich)": [
        "technical-university-of-munich", "technical-university-munich"],
    "The Pennsylvania State University": ["pennsylvania-state-university", "pennsylvania-state-university-university-park"],
    "The University of Adelaide": ["adelaide-university"],
    "Universiti Putra Malaysia (UPM)": ["universiti-putra-malaysia", "putra-university-malaysia"],
    "Universite De Recherche Paris Sciences & Lettres - PSL Research University (Universite Paris Sciences Et Lettres - Universite PSL)": [
        "universite-psl"],
    "Universite Paris-Dauphine (PSL Research University) (Universite Paris IX)": [
        "paris-dauphine-university", "university-of-paris-dauphine"],
    "Ecole Nationale Superieure Des Mines De Paris (Mines Paristech)": [
        "mines-paristech", "ecole-national-superieure-mines-paris"],
    "Espci Paris, Institut Curie": [
        "espci-paristech", "industrial-physics-and-chemistry-higher-educational-institution-paris"],
    "Ecole Normale Superieure (ENS)": ["ecole-normale-superieure-paris"],
    # ENS Cachan was renamed ENS Paris-Saclay in 2016 (same institution)
    "Ecole Normale Superieure Paris-Saclay (ENS Paris-Saclay)": ["ecole-normale-superieure-de-cachan"],
    "University College London (UCL)": ["ucl"],
    "University of Illinois, Urbana - Champaign": ["university-of-illinois-at-urbana-champaign"],
    "University of Michigan, Ann Arbor": ["university-of-michigan-ann-arbor", "university-of-michigan"],
    "University of Washington": ["university-of-washington", "university-of-washington-seattle"],
    "Uppsala Universitet": ["uppsala-university"],
    "Instituto De Empresa (IE Business School)": [],
    "University of London, London Business School": [],
    "Universidad de Barcelona": ["universitat-de-barcelona", "university-of-barcelona"],
    "University of North Carolina at Chapel Hill": ["university-of-north-carolina-chapel-hill"],
    "Wageningen University & Research": [
        "wageningen-university-and-research", "wageningen-university-and-research-center",
        "wageningen-university-and-research-centre"],
    "Universidad De Bologna": ["university-of-bologna", "alma-mater-studiorum-university-of-bologna"],
    "Universitat Autonoma De Barcelona": ["universitat-autonoma-de-barcelona", "autonomous-university-of-barcelona"],
    "Dai Hoc Quoc Gia Thanh Pho Ho Chi Minh (Vietnam National University, Ho Chi Minh City)": [
        "viet-nam-national-university-ho-chi-minh-city"],
    "Indian Institute of Science, Bangalore": ["indian-institute-of-science"],
    "Institut Teknologi Bandung": ["bandung-institute-of-technology"],
    "Norwegian University of Science and Technology": [
        "norwegian-university-of-science-and-technology", "norwegian-university-of-science-and-technology-ntnu"],
}

COUNTRY_ALIASES = {
    "united states of america": "united states",
    "hong kong": "hong kong sar",
    "china": "china mainland",
    "south korea": "south korea",
    "russia": "russia",
    "vietnam": "vietnam",
    "taiwan": "taiwan",
}


def fold(s):
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = s.lower().replace("&", " and ").replace("’", "'")
    s = re.sub(r"[^a-z0-9]+", " ", s)
    s = re.sub(r"^the ", "", s.strip())
    return re.sub(r"\s+", " ", s).strip()


def country_key(c):
    c = fold(c or "")
    return COUNTRY_ALIASES.get(c, c)


def variants(name):
    """Full name plus each part outside/inside parentheses (min 8 chars)."""
    out = {fold(name)}
    outer = re.sub(r"\([^)]*\)", " ", name)
    out.add(fold(outer))
    for inner in re.findall(r"\(([^)]*)\)", name):
        out.add(fold(inner))
    return {v for v in out if len(v) >= 8}


def main():
    roster = json.loads(ROSTER.read_text(encoding="utf-8"))["institutions"]
    prog_ids = {p["institutionId"] for p in json.loads(PROGRAMMES.read_text(encoding="utf-8"))["programmes"]}
    roster_ids = {r["id"] for r in roster}
    by_name = {}
    for r in roster:
        for v in variants(r["name"]):
            by_name.setdefault(v, []).append(r)

    # Verify the transcription against the PDF text.
    text = "\n".join(p.extract_text() or "" for p in pypdf.PdfReader(str(PDF)).pages)
    flat = fold(text)
    for name, *_ in GROUP_A + GROUP_B:
        assert fold(name) in flat, f"not found in PDF: {name}"
    for _, _, subs in GROUP_A:
        for s in subs:
            assert fold(s) in flat, f"constituent not found in PDF: {s}"
    for f in {f for _, _, fs, _ in GROUP_B for f in fs}:
        assert f in D, f"faculty without discipline mapping: {f}"
        printed = re.sub(r"\s*\((for MBAs|master's).*\)$", "", f)
        assert fold(printed) in flat, f"faculty not found in PDF: {f}"

    def match(name, country):
        if name in IDS:
            ids = IDS[name]
            for i in ids:
                assert i in roster_ids, f"unknown id {i}"
            return ids
        ck = country_key(country)
        hits = []
        for v in variants(name):
            for r in by_name.get(v, []):
                rc = country_key(r.get("country"))
                if (rc == ck or not rc) and r["id"] not in hits:
                    hits.append(r["id"])
        return hits

    institutions, unmatched, report = {}, [], []

    def put(ids, entry, label):
        for i in ids:
            if i in institutions and institutions[i] != entry:
                raise SystemExit(f"conflicting entries for {i} ({label})")
            institutions[i] = entry
        report.append((label, ids))

    for name, country, subs in GROUP_A:
        for n in [name, *subs]:
            ids = match(n, country)
            put(ids, {"group": "A"}, n)
            if not ids:
                unmatched.append(f"{n} ({country})")

    for name, country, faculties, agency in GROUP_B:
        ids = match(name, country)
        entry = {"group": "B", "faculties": [
            {"name": f, "agency": agency, "disciplines": D[f]} for f in faculties]}
        put(ids, entry, name)
        if not ids:
            unmatched.append(f"{name} ({country})")

    out = {"source": SOURCE, "institutions": dict(sorted(institutions.items())), "unmatched": unmatched}
    OUT.write_text(json.dumps(out, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")

    subs_n = sum(len(s) for _, _, s in GROUP_A)
    a_main = sum(1 for n, c, _ in GROUP_A if match(n, c))
    print(f"Group A: {len(GROUP_A)} institutions + {subs_n} listed constituents; Group B: {len(GROUP_B)}")
    print(f"ids written: {len(institutions)} ({sum(1 for i in institutions if i in prog_ids)} with programmes)")
    print(f"Group A main rows matched: {a_main}/{len(GROUP_A)}; "
          f"Group B matched: {sum(1 for n, c, *_ in GROUP_B if match(n, c))}/{len(GROUP_B)}; unmatched entries: {len(unmatched)}")
    if "-v" in sys.argv:
        for label, ids in report:
            print(("  " if ids else "! ") + label + " -> " + ", ".join(ids))


if __name__ == "__main__":
    main()
