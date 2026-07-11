const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { URL } = require("node:url");

const PORT = Number(process.env.PORT || 4173);
const IS_VERCEL = Boolean(process.env.VERCEL);
const LOCAL_HOST = process.env.HOST || "127.0.0.1";
const PUBLIC_DIR = path.join(__dirname, "public");
const XTRI_API = "https://api.questoes.xtri.online/api";
const listCache = new Map();
const detailCache = new Map();
const CACHE_TTL = 30 * 60 * 1000;
let questionIndex = new Map();

try {
  const indexed = require("./data/question-index.json");
  questionIndex = new Map(indexed.map((question) => [question.id, question]));
} catch {
  questionIndex = new Map();
}

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon"
};

const AREA_NAMES = {
  linguagens: "Linguagens",
  "ciencias-humanas": "Ciências Humanas",
  "ciencias-natureza": "Ciências da Natureza",
  matematica: "Matemática"
};

const SUBJECT_NAMES = {
  biologia: "Biologia",
  fisica: "Física",
  quimica: "Química",
  historia: "História",
  geografia: "Geografia",
  filosofia: "Filosofia",
  sociologia: "Sociologia"
};

const SUBJECT_AREAS = {
  biologia: "ciencias-natureza",
  fisica: "ciencias-natureza",
  quimica: "ciencias-natureza",
  historia: "ciencias-humanas",
  geografia: "ciencias-humanas",
  filosofia: "ciencias-humanas",
  sociologia: "ciencias-humanas"
};

const CATALOG_GROUPS = {
  linguagens: { label: "Linguagens", area: "linguagens" },
  historia: { label: "História", area: "ciencias-humanas" },
  geografia: { label: "Geografia", area: "ciencias-humanas" },
  filosofia: { label: "Filosofia", area: "ciencias-humanas" },
  sociologia: { label: "Sociologia", area: "ciencias-humanas" },
  biologia: { label: "Biologia", area: "ciencias-natureza" },
  fisica: { label: "Física", area: "ciencias-natureza" },
  quimica: { label: "Química", area: "ciencias-natureza" },
  matematica: { label: "Matemática", area: "matematica" }
};

const TOPICS = [
  {
    id: "geometria-plana",
    label: "Geometria plana",
    aliases: ["geometria plana", "figuras planas", "areas de figuras planas"],
    areas: ["matematica"],
    candidateSkills: ["H7", "H8", "H9", "H10", "H11", "H12", "H13", "H14"],
    keywords: ["area", "perimet", "triang", "quadrad", "retang", "poligon", "circunfer", "circulo", "trapéz", "trapez", "hexag", "terreno", "ladrilh", "piso", "mosaico", "planta baixa"],
    excludes: ["volume", "cilindr", "cone", "esfera", "piramid", "paralelepip", "cubo", "tridimensional"]
  },
  {
    id: "geometria-espacial",
    label: "Geometria espacial",
    aliases: ["geometria espacial", "solidos geometricos", "volume"],
    areas: ["matematica"],
    candidateSkills: ["H6", "H7", "H8", "H9", "H10", "H12", "H14"],
    keywords: ["volume", "cilindr", "cone", "esfera", "piramid", "paralelepip", "cubo", "prisma", "tridimensional", "solido"]
  },
  {
    id: "estatistica",
    label: "Estatística",
    aliases: ["estatistica", "media mediana moda", "analise de dados"],
    areas: ["matematica"],
    candidateSkills: ["H24", "H25", "H26", "H27", "H28", "H29", "H30"],
    keywords: ["media", "mediana", "moda", "desvio", "frequencia", "amostra", "dados", "estatistic", "histograma", "grafico"]
  },
  {
    id: "probabilidade",
    label: "Probabilidade",
    aliases: ["probabilidade", "probabilidades"],
    areas: ["matematica"],
    candidateSkills: ["H2", "H28", "H29", "H30"],
    keywords: ["probabil", "chance", "sorte", "aleatori", "possibilidades"]
  },
  {
    id: "funcoes",
    label: "Funções",
    aliases: ["funcoes", "funcao", "função afim", "função quadratica"],
    areas: ["matematica"],
    candidateSkills: ["H15", "H16", "H17", "H18", "H19", "H20", "H21", "H22", "H23"],
    keywords: ["funcao", "função", "grafico cartesiano", "dominio", "imagem", "variavel", "equacao"]
  },
  {
    id: "razao-proporcao",
    label: "Razão e proporção",
    aliases: ["razao e proporcao", "proporcionalidade", "regra de tres"],
    areas: ["matematica"],
    candidateSkills: ["H3", "H10", "H11", "H12", "H15", "H16", "H17", "H18"],
    keywords: ["propor", "razao", "razão", "escala", "regra de tres", "diretamente", "inversamente"]
  },
  {
    id: "matematica-financeira",
    label: "Matemática financeira",
    aliases: ["matematica financeira", "juros", "porcentagem"],
    areas: ["matematica"],
    candidateSkills: ["H1", "H3", "H4", "H5", "H15", "H16", "H21"],
    keywords: ["juros", "desconto", "porcent", "prestacao", "financ", "rendimento", "taxa mensal", "acrescimo"]
  },
  {
    id: "analise-combinatoria",
    label: "Análise combinatória",
    aliases: ["analise combinatoria", "combinatoria", "principio fundamental da contagem"],
    areas: ["matematica"],
    candidateSkills: ["H2", "H3"],
    keywords: ["combin", "arranjo", "permut", "maneiras distintas", "de quantas maneiras", "formas distintas", "fatorial"]
  },
  {
    id: "ecologia",
    label: "Ecologia",
    aliases: ["ecologia", "meio ambiente", "cadeia alimentar"],
    areas: ["ciencias-natureza"],
    subjects: ["biologia"],
    candidateSkills: ["H4", "H8", "H9", "H10", "H12", "H19", "H28", "H29", "H30"],
    keywords: ["ecolog", "ecossistema", "cadeia alimentar", "teia alimentar", "bioma", "populacao", "comunidade", "habitat", "nicho", "biodivers", "ciclo biogeo", "impacto ambiental"]
  },
  {
    id: "genetica",
    label: "Genética",
    aliases: ["genetica", "hereditariedade", "dna e rna"],
    areas: ["ciencias-natureza"],
    subjects: ["biologia"],
    candidateSkills: ["H11", "H13", "H15", "H16", "H29"],
    keywords: ["genetic", "gene", "dna", "rna", "hereditar", "cromoss", "alelo", "mendel", "genoma", "mutacao"]
  },
  {
    id: "fisiologia",
    label: "Fisiologia humana",
    aliases: ["fisiologia", "fisiologia humana", "corpo humano"],
    areas: ["ciencias-natureza"],
    subjects: ["biologia"],
    candidateSkills: ["H14", "H15", "H18", "H19", "H29", "H30"],
    keywords: ["organismo", "sistema digest", "sistema nerv", "sistema circul", "hormon", "sangue", "rim", "pulmao", "coração", "coracao", "metabol", "imun"]
  },
  {
    id: "citologia",
    label: "Citologia",
    aliases: ["citologia", "biologia celular", "celulas"],
    areas: ["ciencias-natureza"],
    subjects: ["biologia"],
    candidateSkills: ["H11", "H13", "H14", "H15", "H29"],
    keywords: ["celula", "célula", "membrana", "mitocond", "riboss", "organel", "mitose", "meiose", "citoplasm"]
  },
  {
    id: "evolucao",
    label: "Evolução",
    aliases: ["evolucao", "evolução", "selecao natural"],
    areas: ["ciencias-natureza"],
    subjects: ["biologia"],
    candidateSkills: ["H3", "H13", "H16", "H28"],
    keywords: ["evolu", "selecao natural", "seleção natural", "darwin", "adaptacao", "adaptação", "especiacao", "ancestral"]
  },
  {
    id: "mecanica",
    label: "Mecânica",
    aliases: ["mecanica", "cinematica", "dinamica", "leis de newton"],
    areas: ["ciencias-natureza"],
    subjects: ["fisica"],
    candidateSkills: ["H2", "H17", "H18", "H20", "H23"],
    keywords: ["velocidade", "aceleracao", "movimento", "forca", "força", "newton", "trajetoria", "atrito", "massa", "impulso", "energia cinetica", "trabalho mecanico"]
  },
  {
    id: "eletricidade",
    label: "Eletricidade",
    aliases: ["eletricidade", "eletrodinamica", "circuitos eletricos"],
    areas: ["ciencias-natureza"],
    subjects: ["fisica"],
    candidateSkills: ["H5", "H6", "H17", "H18", "H21", "H23"],
    keywords: ["circuito", "corrente eletr", "tensao", "voltag", "resistor", "resistencia", "potencia eletr", "consumo de energia", "carga eletr", "campo eletr"]
  },
  {
    id: "termodinamica",
    label: "Termodinâmica",
    aliases: ["termodinamica", "termologia", "calorimetria"],
    areas: ["ciencias-natureza"],
    subjects: ["fisica"],
    candidateSkills: ["H17", "H18", "H21", "H23"],
    keywords: ["temperatura", "calor", "termic", "térmic", "dilatacao", "pressao", "gas ideal", "maquina termica", "mudanca de estado"]
  },
  {
    id: "optica-ondas",
    label: "Óptica e ondas",
    aliases: ["optica", "ondas", "ondulatoria", "acustica"],
    areas: ["ciencias-natureza"],
    subjects: ["fisica"],
    candidateSkills: ["H1", "H2", "H17", "H18", "H22"],
    keywords: ["onda", "frequencia", "comprimento de onda", "som", "acust", "luz", "reflex", "refrac", "lente", "espelho", "radiacao eletromagnet"]
  },
  {
    id: "quimica-geral",
    label: "Química geral",
    aliases: ["quimica geral", "atomistica", "ligacoes quimicas"],
    areas: ["ciencias-natureza"],
    subjects: ["quimica"],
    candidateSkills: ["H7", "H8", "H17", "H18", "H24", "H25", "H26", "H27"],
    keywords: ["atomo", "elemento quim", "tabela period", "ligacao", "substancia", "mistura", "molecula", "material", "reacao quim", "transformacao quim"]
  },
  {
    id: "quimica-organica",
    label: "Química orgânica",
    aliases: ["quimica organica", "funcoes organicas", "carbono"],
    areas: ["ciencias-natureza"],
    subjects: ["quimica"],
    candidateSkills: ["H18", "H24", "H25", "H26", "H27"],
    keywords: ["organico", "orgânico", "carbono", "hidrocarbon", "alcool", "álcool", "polimero", "polímero", "funcao organica", "combustivel", "ester", "amina"]
  },
  {
    id: "eletroquimica",
    label: "Eletroquímica",
    aliases: ["eletroquimica", "pilhas e eletrolise", "oxirreducao"],
    areas: ["ciencias-natureza"],
    subjects: ["quimica"],
    candidateSkills: ["H17", "H18", "H21", "H24", "H25", "H26"],
    keywords: ["pilha", "eletrolise", "eletrólise", "oxidacao", "oxidação", "reducao", "redução", "eletrodo", "anodo", "catodo", "corrosao"]
  },
  {
    id: "estequiometria",
    label: "Estequiometria",
    aliases: ["estequiometria", "calculos estequiometricos", "mol"],
    areas: ["ciencias-natureza"],
    subjects: ["quimica"],
    candidateSkills: ["H17", "H24", "H25", "H26"],
    keywords: ["estequiometr", "mol", "massa molar", "rendimento", "reagente", "proporcao quim", "equacao quim"]
  },
  {
    id: "historia-brasil",
    label: "História do Brasil",
    aliases: ["historia do brasil", "brasil colonia", "brasil republica"],
    areas: ["ciencias-humanas"],
    subjects: ["historia"],
    candidateSkills: ["H1", "H2", "H3", "H5", "H7", "H9", "H11", "H13", "H14", "H15", "H16", "H22"],
    keywords: ["brasil", "brasileir", "colonia", "império", "imperio", "republica", "getulio", "ditadura", "escrav", "indigena", "quilomb", "canudos"]
  },
  {
    id: "historia-geral",
    label: "História geral",
    aliases: ["historia geral", "historia mundial"],
    areas: ["ciencias-humanas"],
    subjects: ["historia"],
    candidateSkills: ["H1", "H2", "H3", "H5", "H7", "H9", "H11", "H13", "H14", "H15", "H16"],
    keywords: ["revolucao", "revolução", "guerra", "medieval", "antiguidade", "renascimento", "feudal", "imperialismo", "colonialismo", "europa", "africa", "américa"]
  },
  {
    id: "cartografia",
    label: "Cartografia",
    aliases: ["cartografia", "mapas", "escala cartografica"],
    areas: ["ciencias-humanas"],
    subjects: ["geografia"],
    candidateSkills: ["H6", "H26", "H27", "H28", "H29", "H30"],
    keywords: ["mapa", "cartograf", "coordenada", "latitude", "longitude", "projecao", "projeção", "escala", "fuso horario"]
  },
  {
    id: "geografia-fisica",
    label: "Geografia física",
    aliases: ["geografia fisica", "clima", "relevo"],
    areas: ["ciencias-humanas"],
    subjects: ["geografia"],
    candidateSkills: ["H26", "H27", "H28", "H29", "H30"],
    keywords: ["clima", "relevo", "vegetacao", "vegetação", "hidrograf", "solo", "tecton", "erosao", "erosão", "bioma", "atmosfera", "paisagem"]
  },
  {
    id: "geopolitica",
    label: "Geopolítica",
    aliases: ["geopolitica", "globalizacao", "relacoes internacionais"],
    areas: ["ciencias-humanas"],
    subjects: ["geografia"],
    candidateSkills: ["H7", "H8", "H9", "H17", "H18", "H19", "H28", "H29"],
    keywords: ["geopolit", "globaliza", "fronteira", "territorio", "nações", "nacoes", "migracao", "migração", "bloco econom", "fluxo", "guerra fria"]
  },
  {
    id: "filosofia",
    label: "Filosofia",
    aliases: ["filosofia", "etica", "epistemologia"],
    areas: ["ciencias-humanas"],
    subjects: ["filosofia"],
    candidateSkills: ["H1", "H4", "H12", "H14", "H20", "H21", "H23", "H24", "H25"],
    keywords: ["filosof", "etica", "ética", "moral", "conhecimento", "razao", "razão", "virtude", "aristot", "platao", "platão", "kant", "nietzsche", "descartes", "socrates", "foucault", "hobbes"]
  },
  {
    id: "sociologia",
    label: "Sociologia",
    aliases: ["sociologia", "movimentos sociais", "cultura e sociedade"],
    areas: ["ciencias-humanas"],
    subjects: ["sociologia"],
    candidateSkills: ["H3", "H4", "H5", "H8", "H9", "H10", "H11", "H12", "H13", "H14", "H15", "H16", "H20", "H21", "H22", "H24", "H25"],
    keywords: ["sociolog", "sociedade", "classe social", "movimento social", "cultura", "desigualdade", "cidadania", "trabalho", "weber", "durkheim", "marx", "identidade", "inclusao"]
  }
];

const TOPIC_RULE_DEFINITIONS = {
  fisica: [
    ["Cinemática", ["velocidade", "aceleracao", "trajetoria", "movimento uniforme", "movimento retilineo", "queda livre"]],
    ["Dinâmica e leis de Newton", ["forca resultante", "leis de newton", "segunda lei", "atrito", "plano inclinado", "inercia"]],
    ["Estática e equilíbrio", ["equilibrio", "torque", "momento de uma forca", "alavanca", "centro de massa"]],
    ["Hidrostática", ["empuxo", "pressao hidrostatica", "densidade", "fluido", "principio de pascal", "arquimedes", "vasos comunicantes"]],
    ["Gravitação", ["gravitacao", "gravidade", "orbita", "satelite", "lei de kepler", "campo gravitacional"]],
    ["Vetores", ["vetor", "componentes horizontal", "componentes vertical", "decomposicao de forcas"]],
    ["Trabalho, energia e potência", ["trabalho mecanico", "energia cinetica", "energia potencial", "conservacao da energia", "potencia mecanica"]],
    ["Impulso e quantidade de movimento", ["impulso", "quantidade de movimento", "momento linear", "colisao", "choque"]],
    ["Termologia e calorimetria", ["calor especifico", "capacidade termica", "calorimetria", "dilatacao", "mudanca de estado", "equilibrio termico"]],
    ["Termodinâmica e gases", ["gas ideal", "transformacao gasosa", "maquina termica", "primeira lei da termodinamica", "rendimento termico"]],
    ["Óptica geométrica", ["lente", "espelho", "refracao", "reflexao", "imagem real", "imagem virtual", "indice de refracao"]],
    ["Ondulatória", ["onda", "frequencia", "comprimento de onda", "interferencia", "difracao", "ressonancia"]],
    ["Acústica", ["som", "acustica", "nivel sonoro", "efeito doppler", "intensidade sonora"]],
    ["Eletrostática", ["carga eletrica", "campo eletrico", "potencial eletrico", "forca eletrica", "lei de coulomb"]],
    ["Eletrodinâmica e circuitos", ["circuito", "corrente eletrica", "tensao eletrica", "resistor", "resistencia eletrica", "lei de ohm", "lampada", "amperimetro"]],
    ["Magnetismo e eletromagnetismo", ["campo magnetico", "forca magnetica", "inducao eletromagnetica", "ima", "transformador", "fluxo magnetico"]],
    ["Física moderna e radiações", ["radiacao", "radioatividade", "efeito fotoeletrico", "quantum", "meia vida", "raio x", "fusao nuclear", "fissao nuclear"]]
  ],
  quimica: [
    ["Estrutura atômica", ["atomo", "proton", "neutron", "eletron", "isotopo", "modelo atomico"]],
    ["Tabela periódica", ["tabela periodica", "propriedade periodica", "eletronegatividade", "raio atomico"]],
    ["Ligações químicas", ["ligacao ionica", "ligacao covalente", "ligacao metalica", "geometria molecular", "polaridade", "forca intermolecular"]],
    ["Funções inorgânicas", ["acido", "base", "sal ", "oxido", "funcao inorganica"]],
    ["Soluções e concentração", ["solucao", "solubilidade", "concentracao", "diluicao", "mistura de solucoes"]],
    ["Estequiometria", ["estequiometr", "massa molar", "quantidade de materia", "reagente limitante", "rendimento da reacao"]],
    ["Termoquímica", ["entalpia", "termoquim", "calor de reacao", "energia de ligacao", "combustao"]],
    ["Cinética química", ["cinetica quimica", "velocidade da reacao", "energia de ativacao", "catalisador"]],
    ["Equilíbrio químico", ["equilibrio quimico", "constante de equilibrio", "le chatelier"]],
    ["Ácidos, bases e pH", ["ph ", "poh", "acidez", "basicidade", "neutralizacao", "indicador acido"]],
    ["Eletroquímica", ["pilha", "eletrolise", "oxidacao", "reducao", "eletrodo", "corrosao"]],
    ["Química orgânica", ["hidrocarboneto", "funcao organica", "alcool", "aldeido", "cetona", "acido carboxilico", "ester", "amina"]],
    ["Reações orgânicas", ["esterificacao", "saponificacao", "hidrogenacao", "oxidacao de alcool", "reacao organica"]],
    ["Polímeros", ["polimero", "plastico", "polimerizacao", "monomero"]],
    ["Separação de misturas", ["destilacao", "filtracao", "decantacao", "centrifugacao", "separacao de misturas"]],
    ["Gases", ["gas ideal", "volume molar", "pressao parcial", "equacao de clapeyron"]],
    ["Química ambiental", ["chuva acida", "efeito estufa", "poluente", "tratamento de agua", "contaminacao ambiental"]]
  ],
  biologia: [
    ["Bioquímica", ["carboidrato", "lipidio", "proteina", "enzima", "atp", "metabolismo"]],
    ["Citologia", ["celula", "membrana plasmatica", "mitocondria", "ribossomo", "organela", "mitose", "meiose"]],
    ["Genética", ["gene", "dna", "rna", "cromossomo", "alelo", "mendel", "hereditariedade"]],
    ["Biotecnologia", ["transgenico", "clonagem", "engenharia genetica", "pcr", "biotecnologia"]],
    ["Evolução", ["evolucao", "selecao natural", "darwin", "especiacao", "ancestral comum"]],
    ["Ecologia", ["ecossistema", "cadeia alimentar", "teia alimentar", "nicho ecologico", "relacao ecologica", "sucessao ecologica"]],
    ["Ciclos biogeoquímicos", ["ciclo do carbono", "ciclo do nitrogenio", "ciclo da agua", "biogeoquimico"]],
    ["Botânica", ["planta", "vegetal", "fotossintese", "xilema", "floema", "germinacao"]],
    ["Zoologia", ["animal", "vertebrado", "invertebrado", "anfibio", "mamifero", "inseto"]],
    ["Microbiologia", ["bacteria", "virus", "fungo", "protozoario", "micro-organismo"]],
    ["Parasitologia", ["parasita", "verminose", "hospedeiro", "vetor da doenca"]],
    ["Fisiologia humana", ["sistema digestorio", "sistema nervoso", "sistema circulatorio", "hormonio", "rim", "pulmao", "sangue"]],
    ["Imunologia e vacinas", ["sistema imune", "anticorpo", "antigeno", "vacina", "imunizacao"]],
    ["Reprodução e embriologia", ["reproducao", "fecundacao", "embriao", "gestacao", "gameta"]],
    ["Taxonomia e biodiversidade", ["taxonomia", "classificacao biologica", "biodiversidade", "especie"]]
  ],
  matematica: [
    ["Aritmética", ["numero inteiro", "numero natural", "divisibilidade", "multiplo", "divisor", "fracao"]],
    ["Porcentagem", ["porcentagem", "percentual", "taxa percentual"]],
    ["Razão e proporção", ["razao", "proporcao", "regra de tres", "diretamente proporcional", "inversamente proporcional"]],
    ["Matemática financeira", ["juros", "desconto", "prestacao", "financiamento", "rendimento"]],
    ["Análise combinatória", ["analise combinatoria", "arranjo", "permutacao", "fatorial", "principio multiplicativo", "principio fundamental da contagem", "de quantas maneiras", "maneiras distintas", "formas distintas", "numero de possibilidades diferentes", "configuracoes diferentes", "formar duplas", "senha composta", "formatos de senha", "estruturas para senha", "senhas distintas possiveis"]],
    ["Probabilidade", ["probabilidade", "chance", "evento aleatorio", "espaco amostral"]],
    ["Estatística", ["media", "mediana", "moda", "desvio padrao", "frequencia", "amostra"]],
    ["Leitura de gráficos e tabelas", ["grafico", "tabela", "histograma", "diagrama"]],
    ["Geometria plana", ["area", "perimetro", "triangulo", "quadrado", "retangulo", "poligono", "circunferencia"]],
    ["Geometria espacial", ["volume", "cilindro", "cone", "esfera", "piramide", "prisma", "paralelepipedo"]],
    ["Geometria analítica", ["plano cartesiano", "distancia entre pontos", "equacao da reta", "coordenada cartesiana"]],
    ["Trigonometria", ["seno", "cosseno", "tangente", "trigonometr"]],
    ["Grandezas e medidas", ["unidade de medida", "conversao de unidades", "comprimento", "massa", "capacidade"]],
    ["Função afim", ["funcao afim", "funcao do primeiro grau", "funcao linear"]],
    ["Função quadrática", ["funcao quadratica", "funcao do segundo grau", "parabola"]],
    ["Funções exponenciais e logaritmos", ["funcao exponencial", "logaritmo", "exponencial"]],
    ["Progressões", ["progressao aritmetica", "progressao geometrica", "sequencia numerica"]],
    ["Equações e sistemas", ["equacao", "sistema de equacoes", "inequacao"]],
    ["Matrizes", ["matriz", "determinante"]],
    ["Escalas", ["escala", "planta baixa", "mapa"]]
  ],
  historia: [
    ["Antiguidade", ["antiguidade", "grecia antiga", "roma antiga", "egito antigo"]],
    ["Idade Média", ["idade media", "feudalismo", "cruzada", "igreja medieval"]],
    ["Idade Moderna", ["renascimento", "reforma protestante", "absolutismo", "mercantilismo"]],
    ["Revoluções burguesas", ["revolucao francesa", "revolucao inglesa", "iluminismo"]],
    ["Revolução Industrial", ["revolucao industrial", "maquina a vapor", "industrializacao"]],
    ["Imperialismo e colonialismo", ["imperialismo", "colonialismo", "neocolonialismo", "partilha da africa"]],
    ["Guerras mundiais", ["primeira guerra", "segunda guerra", "nazismo", "fascismo", "holocausto"]],
    ["Guerra Fria", ["guerra fria", "uniao sovietica", "muro de berlim", "socialismo real"]],
    ["Brasil Colônia", ["brasil colonia", "engenho", "capitania", "mineracao colonial"]],
    ["Brasil Império", ["brasil imperio", "reinado", "abolicao", "guerra do paraguai"]],
    ["Brasil República", ["republica velha", "era vargas", "estado novo", "republica brasileira"]],
    ["Ditadura militar", ["ditadura militar", "regime militar", "ato institucional", "redemocratizacao"]],
    ["Escravidão e resistência", ["escravidao", "quilombo", "trafico negreiro", "abolicao"]],
    ["Povos indígenas", ["indigena", "povos originarios", "aldeamento"]],
    ["Patrimônio, memória e cultura", ["patrimonio historico", "memoria coletiva", "cultura material"]]
  ],
  geografia: [
    ["Cartografia", ["mapa", "cartografia", "latitude", "longitude", "projecao cartografica", "fuso horario"]],
    ["Climatologia", ["clima", "massa de ar", "precipitacao", "temperatura atmosferica", "el nino"]],
    ["Geomorfologia", ["relevo", "erosao", "tectonismo", "rocha", "placa tectonica"]],
    ["Hidrografia", ["rio", "bacia hidrografica", "aquífero", "recurso hidrico"]],
    ["Biomas e vegetação", ["bioma", "vegetacao", "floresta", "cerrado", "caatinga"]],
    ["População e demografia", ["populacao", "demografia", "taxa de natalidade", "envelhecimento populacional"]],
    ["Migrações", ["migracao", "imigracao", "emigracao", "refugiado"]],
    ["Urbanização", ["urbanizacao", "cidade", "metropole", "rede urbana", "segregacao urbana"]],
    ["Espaço agrário", ["agricultura", "agronegocio", "estrutura fundiaria", "reforma agraria", "campo"]],
    ["Industrialização", ["industria", "industrializacao", "fordismo", "toyotismo", "distrito industrial"]],
    ["Globalização e economia", ["globalizacao", "comercio internacional", "bloco economico", "multinacional"]],
    ["Geopolítica", ["geopolitica", "fronteira", "conflito territorial", "ordem mundial"]],
    ["Energia e recursos naturais", ["matriz energetica", "fonte de energia", "petroleo", "mineracao", "recurso natural"]],
    ["Questões ambientais", ["impacto ambiental", "desmatamento", "poluicao", "mudanca climatica", "sustentabilidade"]]
  ],
  filosofia: [
    ["Filosofia antiga", ["socrates", "platao", "aristoteles", "pre-socratico"]],
    ["Ética", ["etica", "moral", "virtude", "dever moral"]],
    ["Filosofia política", ["estado", "contrato social", "poder politico", "hobbes", "locke", "rousseau"]],
    ["Teoria do conhecimento", ["conhecimento", "verdade", "epistemologia", "racionalismo", "empirismo"]],
    ["Metafísica", ["metafisica", "ser ", "essencia", "existencia"]],
    ["Filosofia moderna", ["descartes", "kant", "hume", "spinoza"]],
    ["Filosofia contemporânea", ["nietzsche", "foucault", "sartre", "habermas"]],
    ["Estética", ["estetica", "arte", "belo", "gosto"]],
    ["Lógica e argumentação", ["logica", "argumento", "falacia", "silogismo"]]
  ],
  sociologia: [
    ["Cultura e identidade", ["cultura", "identidade", "etnocentrismo", "diversidade cultural"]],
    ["Trabalho e sociedade", ["trabalho", "divisao social", "fordismo", "precarizacao"]],
    ["Desigualdade social", ["desigualdade", "classe social", "estratificacao", "pobreza"]],
    ["Cidadania e direitos", ["cidadania", "direitos sociais", "direitos humanos", "politica publica"]],
    ["Movimentos sociais", ["movimento social", "acao coletiva", "mobilizacao social"]],
    ["Poder, Estado e democracia", ["estado", "democracia", "poder", "participacao politica"]],
    ["Indústria cultural e mídia", ["industria cultural", "meios de comunicacao", "midia", "cultura de massa"]],
    ["Sociologia clássica", ["durkheim", "weber", "marx", "fato social"]],
    ["Gênero, raça e diversidade", ["genero", "racismo", "etnia", "discriminacao", "diversidade"]]
  ],
  linguagens: [
    ["Interpretação de texto", ["interpretacao", "efeito de sentido", "objetivo do texto", "ideia principal"]],
    ["Gêneros textuais", ["genero textual", "cronica", "artigo de opiniao", "noticia", "campanha publicitaria"]],
    ["Literatura brasileira", ["romantismo", "realismo", "modernismo", "literatura brasileira"]],
    ["Gramática", ["concordancia", "regencia", "pontuacao", "sintaxe", "morfologia"]],
    ["Variação linguística", ["variacao linguistica", "registro formal", "norma padrao", "preconceito linguistico"]],
    ["Artes", ["pintura", "escultura", "teatro", "danca", "arte contemporanea"]],
    ["Educação física", ["esporte", "atividade fisica", "corpo", "jogo", "luta"]]
  ]
};

const DETAILED_TOPIC_RULES = Object.entries(TOPIC_RULE_DEFINITIONS).flatMap(([group, rules]) =>
  rules.map(([label, keywords]) => ({
    id: `catalogo:${normalizeText(label).replaceAll(" ", "-")}`,
    label,
    aliases: [label],
    areas: [SUBJECT_AREAS[group] || group],
    subjects: SUBJECT_AREAS[group] ? [group] : [],
    catalogGroup: group,
    keywords
  }))
);

const SEARCHABLE_TOPICS = [...TOPICS];
for (const topic of DETAILED_TOPIC_RULES) {
  if (!SEARCHABLE_TOPICS.some((candidate) => normalizeText(candidate.label) === normalizeText(topic.label))) {
    SEARCHABLE_TOPICS.push(topic);
  }
}
const TOPIC_BY_ID = new Map(SEARCHABLE_TOPICS.map((topic) => [topic.id, topic]));

function sendJson(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(payload));
}

function safeStaticPath(urlPath) {
  const requested = urlPath === "/" ? "index.html" : urlPath.replace(/^\/+/, "");
  const resolved = path.resolve(PUBLIC_DIR, requested);
  return resolved.startsWith(PUBLIC_DIR) ? resolved : null;
}

function serveStatic(req, res, urlPath) {
  const filePath = safeStaticPath(urlPath);
  if (!filePath) return sendJson(res, 403, { error: "Caminho inválido." });
  fs.readFile(filePath, (error, data) => {
    if (error) {
      if (error.code === "ENOENT") {
        return fs.readFile(path.join(PUBLIC_DIR, "index.html"), (fallbackError, html) => {
          if (fallbackError) return sendJson(res, 404, { error: "Arquivo não encontrado." });
          res.writeHead(200, { "Content-Type": MIME_TYPES[".html"] });
          res.end(html);
        });
      }
      return sendJson(res, 500, { error: "Não foi possível ler o arquivo." });
    }
    res.writeHead(200, {
      "Content-Type": MIME_TYPES[path.extname(filePath)] || "application/octet-stream",
      "Cache-Control": path.extname(filePath) === ".html" ? "no-cache" : "public, max-age=3600"
    });
    res.end(data);
  });
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "PrismaENEM/6.0"
    },
    signal: AbortSignal.timeout(20000)
  });
  if (!response.ok) {
    throw new Error(`A fonte respondeu com status ${response.status}.`);
  }
  return response.json();
}

async function fetchYear(year) {
  const cached = listCache.get(year);
  if (cached && Date.now() - cached.savedAt < CACHE_TTL) return cached.value;

  let next = `${XTRI_API}/questions/?year=${year}`;
  const questions = [];
  let guard = 0;
  while (next && guard < 5) {
    const page = await fetchJson(next);
    questions.push(...(page.results || []).map((question) => ({
      ...question,
      ...(questionIndex.get(question.id) || {})
    })));
    next = page.next;
    guard += 1;
  }
  listCache.set(year, { savedAt: Date.now(), value: questions });
  return questions;
}

async function mapLimit(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  async function run() {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}

async function fetchQuestion(id) {
  const cached = detailCache.get(id);
  if (cached && Date.now() - cached.savedAt < CACHE_TTL) return cached.value;
  const question = await fetchJson(`${XTRI_API}/questions/${id}/`);
  detailCache.set(id, { savedAt: Date.now(), value: question });
  return question;
}

function difficultyFromPercentile(percentile) {
  if (!Number.isFinite(percentile)) return null;
  if (percentile <= 0.25) return "facil";
  if (percentile <= 0.65) return "media";
  if (percentile <= 0.9) return "dificil";
  return "muito-dificil";
}

function difficultyFor(question) {
  return question.difficulty || difficultyFromPercentile(Number(question.difficultyPercentile));
}

function hasStableDifficulty(question) {
  if (question.param_b === null || question.param_b === undefined || question.param_b === "") return false;
  const b = Number(question.param_b);
  return Number.isFinite(b) && b >= -3 && b <= 6;
}

function annotateDifficulties(questions) {
  const annotated = questions.map((question) => ({ ...question }));
  const groups = new Map();
  for (const question of annotated) {
    if (!hasStableDifficulty(question)) continue;
    const key = `${question.year}:${question.discipline}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(question);
  }
  for (const group of groups.values()) {
    group.sort((first, second) => Number(first.param_b) - Number(second.param_b));
    group.forEach((question, index) => {
      const percentile = (index + 0.5) / group.length;
      question.difficultyPercentile = percentile;
      question.difficulty = difficultyFromPercentile(percentile);
    });
  }
  return annotated;
}

function annotateRelativeGroup(questions) {
  const stable = questions.filter(hasStableDifficulty).map((question) => ({ ...question }));
  stable.sort((first, second) => Number(first.param_b) - Number(second.param_b));
  stable.forEach((question, index) => {
    const percentile = (index + 0.5) / stable.length;
    question.difficultyPercentile = percentile;
    question.difficulty = difficultyFromPercentile(percentile);
  });
  return stable;
}

function normalizeText(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function skillNumber(question) {
  return Number(String(question.skill?.code || "").replace(/\D/g, "")) || 0;
}

const SUBJECT_TERMS = {
  fisica: [
    "circuito", "corrente eletr", "tensao eletr", "resistor", "resistencia eletr", "potencia eletr",
    "volt", "ampere", "watt", "lampada", "fio resistivo", "campo eletr", "carga eletr", "movimento",
    "velocidade", "aceleracao", "forca", "newton", "atrito", "trajetoria", "onda", "frequencia",
    "lente", "espelho", "refracao", "reflexao", "pressao", "empuxo", "gravit", "energia cinetica",
    "energia potencial", "trabalho mecanico", "calor especifico", "dilatacao", "temperatura"
  ],
  quimica: [
    "substancia", "formula quim", "reacao quim", "transformacao quim", "elemento quim", "molecula",
    "atomo", "mol ", "massa molar", "estequiometr", "solucao", "concentracao", "ph ", "acido",
    "base ", "oxidacao", "reducao", "eletrolise", "pilha", "eletrodo", "catalis", "equilibrio quim",
    "entalpia", "delta h", "combustao", "combustivel", "dioxido de carbono", "benzeno", "etanol",
    "metano", "octano", "hidrocarbon", "polimero", "ligacao quim", "tabela period", "rendimento"
  ],
  biologia: [
    "celula", "organela", "membrana celular", "dna", "rna", "gene", "cromoss", "alelo", "hereditar",
    "organismo", "especie", "populacao", "ecossistema", "cadeia alimentar", "teia alimentar", "bioma",
    "biodivers", "selecao natural", "evolucao", "adaptacao", "fotossint", "respiracao celular",
    "metabolismo", "enzima", "proteina", "hormonio", "sistema imun", "anticorpo", "vacina", "virus",
    "bacteria", "fungo", "parasita", "tecido", "orgao", "fisiolog", "reproducao", "biotecnolog"
  ],
  historia: [
    "seculo", "revolucao", "imperio", "republica", "colonia", "colonial", "escrav", "guerra",
    "ditadura", "governo", "reinado", "idade media", "antiguidade", "renascimento", "feudal",
    "getulio", "vargas", "quilombo", "canudos", "independencia", "patrimonio histor", "memoria"
  ],
  geografia: [
    "territorio", "espaco geogra", "paisagem", "mapa", "cartograf", "latitude", "longitude", "clima",
    "relevo", "vegetacao", "hidrograf", "solo", "urbaniza", "migracao", "populacao", "fronteira",
    "globaliza", "fluxo", "regiao", "agricultura", "industria", "rede urbana", "geopolit"
  ],
  filosofia: [
    "filosof", "etica", "moral", "virtude", "razao", "conhecimento", "verdade", "justica",
    "aristot", "platao", "socrates", "kant", "nietzsche", "descartes", "foucault", "hobbes",
    "rousseau", "epistem", "metafis", "existencial"
  ],
  sociologia: [
    "sociolog", "sociedade", "classe social", "movimento social", "desigualdade", "cidadania",
    "identidade", "cultura", "inclusao", "trabalho", "capitalismo", "weber", "durkheim", "marx",
    "instituicao social", "grupo social", "relacoes sociais", "meios de comunicacao"
  ]
};

function scoreSubject(text, subject) {
  return SUBJECT_TERMS[subject].reduce((score, term) => {
    const normalized = normalizeText(term);
    return score + (text.includes(normalized) ? Math.max(1, normalized.split(" ").length) : 0);
  }, 0);
}

function subjectFromSkill(question) {
  const skill = skillNumber(question);
  if (question.discipline === "ciencias-natureza") {
    if ([1, 5, 6, 20, 21, 22, 23].includes(skill)) return "fisica";
    if ([7, 8, 18, 24, 25, 26, 27].includes(skill)) return "quimica";
    if ([2, 3, 4, 9, 10, 11, 12, 13, 14, 15, 16, 19, 28, 29, 30].includes(skill)) return "biologia";
  }
  if (question.discipline === "ciencias-humanas") {
    if ([1, 2, 3, 4, 5, 11, 13, 14, 15].includes(skill)) return "historia";
    if ([6, 7, 8, 9, 17, 18, 19, 26, 27, 28, 29, 30].includes(skill)) return "geografia";
    if ([12, 23].includes(skill)) return "filosofia";
    if ([10, 16, 20, 21, 22, 24, 25].includes(skill)) return "sociologia";
  }
  return null;
}

function subjectFor(question) {
  if (question.indexedSubject) return question.indexedSubject;
  const candidates = question.discipline === "ciencias-natureza"
    ? ["fisica", "quimica", "biologia"]
    : question.discipline === "ciencias-humanas"
      ? ["historia", "geografia", "filosofia", "sociologia"]
      : [];
  if (!candidates.length) return null;

  const text = questionSearchText(question);
  const skillSubject = subjectFromSkill(question);
  const ranked = candidates.map((subject) => ({
    subject,
    score: scoreSubject(text, subject) + (subject === skillSubject ? 1.5 : 0)
  })).sort((first, second) => second.score - first.score);

  return ranked[0].score > 1.5 ? ranked[0].subject : skillSubject;
}

function questionSearchText(question) {
  if (question.searchText) return normalizeText(question.searchText);
  return normalizeText([
    question.context,
    question.contextLocal,
    question.alternativesIntroduction,
    question.skill?.label,
    ...(question.alternatives || []).map((alternative) => alternative.text)
  ].filter(Boolean).join(" "));
}

function resolveTopic(value) {
  const normalized = normalizeText(value);
  if (!normalized) return null;
  return SEARCHABLE_TOPICS.find((topic) =>
    topic.id === value ||
    normalizeText(topic.label) === normalized ||
    (topic.aliases || []).some((alias) => normalizeText(alias) === normalized)
  ) || null;
}

const TOPIC_STOPWORDS = new Set(["de", "da", "do", "das", "dos", "e", "em", "com", "para", "sobre", "questao", "questoes"]);

function freeTopic(value) {
  const label = String(value || "").trim().slice(0, 100);
  if (!label) return null;
  return {
    id: `livre:${normalizeText(label)}`,
    label,
    free: true,
    keywords: normalizeText(label).split(" ").filter((token) => token.length >= 3 && !TOPIC_STOPWORDS.has(token))
  };
}

function topicCandidate(question, topic) {
  if (topic.free) return true;
  if ((question.indexedTopics || []).some((label) => normalizeText(label) === normalizeText(topic.label))) {
    return true;
  }
  if (!topic.areas.includes(question.discipline)) return false;
  if (topic.candidateSkills?.length && !topic.candidateSkills.includes(question.skill?.code)) return false;
  return true;
}

function matchesTopic(question, topic) {
  if (!topicCandidate(question, topic)) return false;
  const text = normalizeText([
    questionSearchText(question),
    ...(question.indexedTopics || [])
  ].join(" "));
  if (topic.free) {
    const phrase = normalizeText(topic.label);
    if (text.includes(phrase)) return true;
    if (!topic.keywords.length) return false;
    return topic.keywords.every((keyword) => {
      const stem = keyword.length > 5 ? keyword.slice(0, Math.max(5, keyword.length - 2)) : keyword;
      return text.includes(keyword) || text.includes(stem);
    });
  }
  const matches = topic.keywords.filter((keyword) => text.includes(normalizeText(keyword))).length;
  const excluded = (topic.excludes || []).some((keyword) => text.includes(normalizeText(keyword)));
  return matches > 0 && !excluded;
}

function detailedTopicsFor(question) {
  const group = subjectFor(question) || question.discipline;
  const text = questionSearchText(question);
  return DETAILED_TOPIC_RULES
    .filter((topic) => topic.catalogGroup === group)
    .map((topic) => ({
      topic,
      score: topic.keywords.reduce((total, keyword) => {
        const normalized = normalizeText(keyword);
        return total + (text.includes(normalized) ? Math.max(1, normalized.split(" ").length) : 0);
      }, 0)
    }))
    .filter(({ score }) => score > 0)
    .sort((first, second) => second.score - first.score)
    .slice(0, 2)
    .map(({ topic }) => topic.label);
}

function defaultTopicFor(question) {
  const skill = skillNumber(question);
  const subject = subjectFor(question);
  if (question.discipline === "matematica") {
    if (skill <= 5) return "Aritmética e conhecimentos numéricos";
    if (skill <= 7) return "Geometria espacial";
    if (skill <= 9) return "Geometria plana";
    if (skill <= 14) return "Grandezas e medidas";
    if (skill <= 18) return "Razão, proporção e variação";
    if (skill <= 23) return "Álgebra e funções";
    if (skill <= 27) return "Gráficos e estatística";
    return "Estatística e probabilidade";
  }
  if (question.discipline === "ciencias-natureza") {
    const bySkill = {
      H1: "Ondulatória", H5: "Circuitos elétricos", H9: "Ciclos biogeoquímicos",
      H10: "Impactos ambientais", H11: "Biotecnologia", H13: "Genética",
      H14: "Fisiologia", H15: "Biologia experimental", H16: "Evolução",
      H20: "Mecânica", H21: subject === "quimica" ? "Termoquímica" : "Termodinâmica e eletromagnetismo",
      H22: "Radiação e matéria", H23: subject === "quimica" ? "Energia nas reações químicas" : "Energia",
      H24: "Nomenclatura e transformações químicas", H25: "Materiais e processos químicos",
      H26: "Recursos energéticos e minerais", H27: "Química ambiental",
      H28: "Adaptação e ecologia", H29: "Biotecnologia", H30: "Saúde e ambiente"
    };
    const fallback = {
      fisica: "Mecânica e energia",
      quimica: "Materiais e transformações químicas",
      biologia: "Ecologia e saúde"
    };
    return bySkill[question.skill?.code] || fallback[subject] || "Ciência, tecnologia e ambiente";
  }
  if (question.discipline === "ciencias-humanas") {
    const bySkill = {
      H1: "Fontes históricas e geográficas", H2: "Memória e sociedade", H3: "Cultura e processos históricos",
      H6: "Cartografia", H7: "Relações de poder e geopolítica", H8: "População e Estado",
      H10: "Movimentos sociais", H12: "Justiça e sociedade", H16: "Tecnologia e trabalho",
      H17: "Território e produção", H18: "Economia e espaço", H19: "Espaço rural e urbano",
      H21: "Comunicação e sociedade", H22: "Direitos e políticas públicas", H23: "Ética e política",
      H24: "Cidadania e democracia", H25: "Inclusão social", H26: "Paisagem e ocupação",
      H27: "Sociedade e meio físico", H28: "Tecnologia e impactos ambientais",
      H29: "Recursos naturais e espaço geográfico", H30: "Preservação ambiental"
    };
    const fallback = {
      historia: "Processos históricos",
      geografia: "Espaço geográfico",
      filosofia: "Ética e teoria do conhecimento",
      sociologia: "Sociedade e cidadania"
    };
    return bySkill[question.skill?.code] || fallback[subject] || "Sociedade, cultura e território";
  }
  if (question.discipline === "linguagens") {
    if (question.language) return question.language === "ingles" ? "Língua inglesa" : "Língua espanhola";
    if ([9, 10, 11].includes(skill)) return "Educação física";
    if ([12, 13, 14, 15, 16, 17].includes(skill)) return "Literatura";
    if ([18, 19, 20, 21].includes(skill)) return "Artes";
    if ([25, 26, 27].includes(skill)) return "Gramática e variação linguística";
    return "Interpretação e gêneros textuais";
  }
  return AREA_NAMES[question.discipline] || "Conhecimentos gerais";
}

function topicsFor(question) {
  if (question.indexedTopics?.length) return question.indexedTopics;
  const detailed = detailedTopicsFor(question);
  const subject = subjectFor(question);
  const matched = TOPICS
    .filter((topic) => !topic.subjects?.length || topic.subjects.includes(subject))
    .filter((topic) => normalizeText(topic.label) !== normalizeText(SUBJECT_NAMES[subject] || ""))
    .filter((topic) => matchesTopic(question, topic))
    .map((topic) => topic.label);
  const combined = [...new Set([...detailed, ...matched])];
  return combined.length ? combined : [defaultTopicFor(question)];
}

function subjectTopicsFor(question) {
  const subject = subjectFor(question);
  const generic = normalizeText(SUBJECT_NAMES[subject] || "");
  return topicsFor(question).filter((topic) => normalizeText(topic) !== generic);
}

function mediaUrl(value) {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object") return value.localUrl || value.url || value.file || value.path || null;
  return null;
}

function markdownMediaUrls(value = "") {
  return [...String(value).matchAll(/!\[[^\]]*\]\((https?:\/\/[^)]+)\)/gi)].map((match) => match[1]);
}

function mediaCandidates(item) {
  const values = [
    item.image,
    item.file,
    item.localFile,
    ...(Array.isArray(item.files) ? item.files.flatMap((file) => [file, file?.localUrl, file?.url]) : []),
    ...markdownMediaUrls(item.context),
    ...markdownMediaUrls(item.contextLocal)
  ].map(mediaUrl).filter(Boolean);
  return [...new Set(values.filter((value) => /^https:\/\//i.test(value)))];
}

function proxiedMediaUrl(candidates) {
  if (!candidates?.length) return null;
  return `/api/media?${candidates.map((candidate) => `url=${encodeURIComponent(candidate)}`).join("&")}`;
}

function isCompleteQuestion(question) {
  const alternatives = question.alternatives || [];
  if (alternatives.length !== 5) return false;
  const expectedLetters = ["A", "B", "C", "D", "E"];
  const alternativesAreComplete = alternatives.every((alternative, index) =>
    String(alternative.letter || "").toUpperCase() === expectedLetters[index]
    && (String(alternative.text || "").trim() || mediaCandidates(alternative).length)
  );
  if (!alternativesAreComplete) return false;

  const meaningfulContext = String(question.contextLocal || question.context || "")
    .replace(/!\[[^\]]*\]\([^)]+\)/gi, " ")
    .replace(/dispon[ií]vel em:[^\n]*/gi, " ")
    .replace(/acesso em:[^\n]*/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  const imageOnlyAlternatives = alternatives.every((alternative) => !String(alternative.text || "").trim());
  if (imageOnlyAlternatives && meaningfulContext.length < 80) return false;

  return Boolean(meaningfulContext || String(question.alternativesIntroduction || "").trim());
}

function catalogTopicGroups() {
  const grouped = new Map();
  for (const question of questionIndex.values()) {
    const groupId = question.indexedSubject || question.discipline;
    const definition = CATALOG_GROUPS[groupId];
    if (!definition) continue;
    if (!grouped.has(groupId)) grouped.set(groupId, new Map());
    const topics = grouped.get(groupId);
    for (const topic of question.indexedTopics || []) {
      if (normalizeText(topic) === normalizeText(definition.label)) continue;
      topics.set(topic, (topics.get(topic) || 0) + 1);
    }
  }
  return [...grouped.entries()]
    .map(([id, topics]) => ({
      id,
      ...CATALOG_GROUPS[id],
      topics: [...topics.entries()]
        .map(([label, count]) => ({ label, count }))
        .sort((first, second) => first.label.localeCompare(second.label, "pt-BR"))
    }))
    .filter((group) => group.topics.length)
    .sort((first, second) => first.label.localeCompare(second.label, "pt-BR"));
}

function seededRandom(seedText) {
  let seed = 2166136261;
  for (const char of seedText) {
    seed ^= char.charCodeAt(0);
    seed = Math.imul(seed, 16777619);
  }
  return () => {
    seed += 0x6d2b79f5;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled(items, random) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [copy[index], copy[other]] = [copy[other], copy[index]];
  }
  return copy;
}

function normalizePayload(input) {
  const years = [...new Set((input.years || []).map(Number))]
    .filter((year) => year >= 2009 && year <= 2025)
    .slice(0, 17);
  const areas = [...new Set(input.areas || [])].filter((area) => AREA_NAMES[area]);
  const subjects = [...new Set(input.subjects || [])].filter((subject) => SUBJECT_NAMES[subject]);
  const topicQuery = String(input.topic || "").trim().slice(0, 100);
  const topic = resolveTopic(topicQuery);
  const requested = {
    facil: Math.max(0, Number(input.distribution?.facil) || 0),
    media: Math.max(0, Number(input.distribution?.media) || 0),
    dificil: Math.max(0, Number(input.distribution?.dificil) || 0),
    "muito-dificil": Math.max(0, Number(input.distribution?.["muito-dificil"]) || 0)
  };
  const total = Object.values(requested).reduce((sum, value) => sum + value, 0);
  return {
    years,
    areas,
    subjects,
    topic: topic?.id || null,
    topicQuery,
    language: input.language === "espanhol" ? "espanhol" : "ingles",
    requested,
    total,
    seed: String(input.seed || `${Date.now()}-${Math.random()}`)
  };
}

function dedupeLanguage(questions, language) {
  return questions.filter((question) => !question.language || question.language === language);
}

async function generateQuestions(input) {
  const config = normalizePayload(input);
  if (!config.years.length) throw Object.assign(new Error("Escolha ao menos um ano."), { status: 400 });
  if (!config.areas.length) throw Object.assign(new Error("Escolha ao menos uma área."), { status: 400 });
  if (config.total < 1 || config.total > 90) {
    throw Object.assign(new Error("O caderno deve ter entre 1 e 90 questões."), { status: 400 });
  }

  const yearly = await mapLimit(config.years, 4, fetchYear);
  let pool = dedupeLanguage(yearly.flat(), config.language);
  pool = pool.filter((question) => config.areas.includes(question.discipline));
  pool = annotateDifficulties(pool);
  pool = pool.filter((question) => difficultyFor(question));
  if (config.subjects.length) {
    const needsContent = pool.filter((question) => !question.searchText);
    if (needsContent.length) {
      const enrichedById = new Map((await mapLimit(needsContent, 12, async (question) => ({
        ...(await fetchQuestion(question.id)),
        difficulty: question.difficulty,
        difficultyPercentile: question.difficultyPercentile
      }))).map((question) => [question.id, question]));
      pool = pool.map((question) => enrichedById.get(question.id) || question);
    }
    pool = pool.filter((question) => config.subjects.includes(subjectFor(question)));
  }

  const requestedTopic = config.topic
    ? TOPIC_BY_ID.get(config.topic)
    : config.topicQuery
      ? freeTopic(config.topicQuery)
      : null;
  if (requestedTopic) {
    const candidates = pool.filter((question) => topicCandidate(question, requestedTopic));
    const enriched = await mapLimit(candidates, 12, async (question) => {
      const detail = question.alternatives ? question : await fetchQuestion(question.id);
      return {
        ...question,
        ...detail,
        difficulty: question.difficulty,
        difficultyPercentile: question.difficultyPercentile
      };
    });
    pool = annotateRelativeGroup(
      enriched.filter((question) => matchesTopic(question, requestedTopic) && isCompleteQuestion(question))
    );
  }

  const byDifficulty = {
    facil: [],
    media: [],
    dificil: [],
    "muito-dificil": []
  };
  for (const question of pool) byDifficulty[difficultyFor(question)].push(question);

  const availability = Object.fromEntries(
    Object.entries(byDifficulty).map(([level, questions]) => [level, questions.length])
  );
  for (const [level, amount] of Object.entries(config.requested)) {
    if (amount > availability[level]) {
      const error = new Error("Não há questões suficientes para a combinação escolhida.");
      error.status = 422;
      error.availability = availability;
      throw error;
    }
  }

  const random = seededRandom(config.seed);
  const selectedByLevel = await Promise.all(
    Object.entries(config.requested).map(async ([level, amount]) => {
      if (!amount) return [];
      const candidates = shuffled(byDifficulty[level], random);
      const complete = [];
      let cursor = 0;
      while (complete.length < amount && cursor < candidates.length) {
        const remaining = amount - complete.length;
        const batch = candidates.slice(cursor, cursor + Math.max(8, remaining));
        cursor += batch.length;
        const details = await mapLimit(batch, 8, async (question) => {
          const detail = question.alternatives ? question : await fetchQuestion(question.id);
          return {
            ...question,
            ...detail,
            difficulty: question.difficulty,
            difficultyPercentile: question.difficultyPercentile
          };
        });
        complete.push(...details.filter(isCompleteQuestion).slice(0, remaining));
      }
      if (complete.length < amount) {
        const error = new Error("Não há questões completas suficientes para a combinação escolhida.");
        error.status = 422;
        error.availability = availability;
        throw error;
      }
      return complete;
    })
  );
  const details = shuffled(selectedByLevel.flat(), random);

  return {
    generatedAt: new Date().toISOString(),
    source: "XTRI / microdados INEP",
    methodology: requestedTopic
      ? "Classificação relativa por percentil do parâmetro b dentro do assunto selecionado: 25% fáceis, 40% médias, 25% difíceis e 10% muito difíceis."
      : "Classificação relativa por percentil do parâmetro b dentro da mesma área e edição: 25% fáceis, 40% médias, 25% difíceis e 10% muito difíceis. Itens com b fora de −3 a 6 são descartados.",
    filters: {
      subjects: config.subjects.map((subject) => SUBJECT_NAMES[subject]),
      topic: requestedTopic?.label || null
    },
    availability,
    questions: details.map((question, index) => ({
      ...question,
      order: index + 1,
      difficulty: difficultyFor(question),
      areaLabel: AREA_NAMES[question.discipline] || question.discipline,
      subject: subjectFor(question),
      subjectLabel: SUBJECT_NAMES[subjectFor(question)] || null,
      topicLabels: requestedTopic ? [requestedTopic.label] : subjectTopicsFor(question).slice(0, 2),
      imageCandidates: mediaCandidates(question),
      image: proxiedMediaUrl(mediaCandidates(question)),
      alternatives: (question.alternatives || []).map((alternative) => ({
        ...alternative,
        imageCandidates: mediaCandidates(alternative),
        image: proxiedMediaUrl(mediaCandidates(alternative))
      }))
    }))
  };
}

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 100_000) throw Object.assign(new Error("Pedido muito grande."), { status: 413 });
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  } catch {
    throw Object.assign(new Error("JSON inválido."), { status: 400 });
  }
}

async function proxyMedia(requestUrl, res) {
  const candidates = requestUrl.searchParams.getAll("url").slice(0, 6);
  const allowedHosts = new Set(["api.questoes.xtri.online", "enem.dev"]);
  for (const candidate of candidates) {
    try {
      const target = new URL(candidate);
      if (target.protocol !== "https:" || !allowedHosts.has(target.hostname)) continue;
      const response = await fetch(target, {
        headers: { Accept: "image/*", "User-Agent": "PrismaENEM/6.0" },
        signal: AbortSignal.timeout(15000)
      });
      const contentType = response.headers.get("content-type") || "";
      if (!response.ok || !contentType.startsWith("image/")) continue;
      const bytes = Buffer.from(await response.arrayBuffer());
      res.writeHead(200, {
        "Content-Type": contentType,
        "Content-Length": bytes.length,
        "Cache-Control": "public, max-age=86400",
        "X-Content-Type-Options": "nosniff"
      });
      res.end(bytes);
      return;
    } catch {
      // Try the next known source.
    }
  }
  sendJson(res, 404, { error: "Figura indisponível nas fontes conhecidas." });
}

async function handleRequest(req, res) {
  const requestUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  try {
    if (requestUrl.pathname === "/api/status" && req.method === "GET") {
      return sendJson(res, 200, {
        ok: true,
        source: "https://api.questoes.xtri.online",
        cachedYears: listCache.size,
        cachedQuestions: detailCache.size
      });
    }
    if (requestUrl.pathname === "/api/catalog" && req.method === "GET") {
      return sendJson(res, 200, {
        subjects: Object.entries(SUBJECT_NAMES).map(([id, label]) => ({
          id,
          label,
          area: SUBJECT_AREAS[id]
        })),
        topics: SEARCHABLE_TOPICS.map(({ id, label, areas, subjects }) => ({
          id,
          label,
          areas,
          subjects: subjects || []
        })),
        groups: catalogTopicGroups()
      });
    }
    if (requestUrl.pathname === "/api/media" && req.method === "GET") {
      return proxyMedia(requestUrl, res);
    }
    if (requestUrl.pathname === "/api/questions/generate" && req.method === "POST") {
      const payload = await readBody(req);
      const result = await generateQuestions(payload);
      return sendJson(res, 200, result);
    }
    if (requestUrl.pathname.startsWith("/api/")) {
      return sendJson(res, 404, { error: "Rota não encontrada." });
    }
    return serveStatic(req, res, requestUrl.pathname);
  } catch (error) {
    console.error(`[${new Date().toISOString()}]`, error);
    return sendJson(res, error.status || 502, {
      error: error.message || "Não foi possível consultar as questões agora.",
      availability: error.availability,
      supportedTopics: error.supportedTopics
    });
  }
}

const server = http.createServer(handleRequest);

function startServer() {
  const onListening = () => {
    const localUrl = IS_VERCEL ? `http://localhost:${PORT}` : `http://${LOCAL_HOST}:${PORT}`;
    console.log(`Prisma ENEM disponível em ${localUrl}`);
  };

  if (IS_VERCEL) {
    server.listen(PORT, onListening);
  } else {
    server.listen(PORT, LOCAL_HOST, onListening);
  }

  return server;
}

if (require.main === module) {
  startServer();
}

Object.assign(handleRequest, {
  annotateDifficulties,
  detailedTopicsFor,
  difficultyFor,
  difficultyFromPercentile,
  isCompleteQuestion,
  matchesTopic,
  mediaCandidates,
  normalizePayload,
  normalizeText,
  questionSearchText,
  resolveTopic,
  seededRandom,
  server,
  startServer,
  subjectFor,
  topicsFor,
  TOPICS
});

module.exports = handleRequest;
