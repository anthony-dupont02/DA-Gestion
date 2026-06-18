
// Réinitialisation automatique du compte admin si aucun utilisateur valide
(function(){
 try{
   const users = JSON.parse(localStorage.getItem("utilisateurs")||"[]");
   if(!Array.isArray(users) || users.length===0){
      localStorage.removeItem("utilisateurs");
   }
 }catch(e){
   localStorage.removeItem("utilisateurs");
 }
})();

/* =====================================
   SYSTÈME DE CONNEXION UTILISATEURS
===================================== */

const utilisateursParDefaut = [
  { login: "admin", motDePasseHash: null, _defaultPass: true, nom: "Administrateur", role: "admin" }
];

/* Utilisateurs en mémoire (chargés depuis Firebase au démarrage) */
let _utilisateursCache = null;

function getUtilisateurs(){
  if(_utilisateursCache) return _utilisateursCache;
  const local = JSON.parse(localStorage.getItem("utilisateurs") || "[]");
  if(local.length > 0){ _utilisateursCache = local; return local; }
  return utilisateursParDefaut;
}

function saveUtilisateurs(users){
  _utilisateursCache = users;
  localStorage.setItem("utilisateurs", JSON.stringify(users));
  // Sauvegarder aussi dans Firebase
  if(db && _firebaseActif){
    db.ref("/utilisateurs").set(users).catch(e => console.warn("Erreur save utilisateurs:", e));
  }
}

function getSessionUtilisateur(){
  return JSON.parse(sessionStorage.getItem("session_user")) || null;
}

function hashPassword(str){
  // Hash simple déterministe côté client (non-cryptographique mais masque le mot de passe en clair)
  let hash = 0;
  for(let i = 0; i < str.length; i++){
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return "h" + Math.abs(hash).toString(16);
}

function connecterUtilisateur(login, motDePasse){
  const users = getUtilisateurs();
  const hashed = hashPassword(motDePasse);
  // Vérifier aussi le mot de passe par défaut admin si _defaultPass
  const user = users.find(u => {
    if(u.login !== login.trim()) return false;
    if(u.motDePasseHash === hashed) return true;
    if(u.motDePasse === motDePasse) return true;
    if(u._defaultPass && motDePasse === "glasspro2024") return true;
    return false;
  });
  if(user){
    // Migration : si mot de passe encore en clair, on le hash
    if(user.motDePasse && !user.motDePasseHash){
      user.motDePasseHash = hashPassword(user.motDePasse);
      delete user.motDePasse;
      const allUsers = getUtilisateurs();
      const idx = allUsers.findIndex(u => u.login === user.login);
      if(idx >= 0){ allUsers[idx] = user; saveUtilisateurs(allUsers); }
    }
    sessionStorage.setItem("session_user", JSON.stringify(user));
    return user;
  }
  return null;
}

function deconnecterUtilisateur(){
  sessionStorage.removeItem("session_user");
  afficherEcranLogin();
}

function afficherEcranLogin(){
  document.getElementById("appContainer").style.display = "none";
  const loginDiv = document.getElementById("loginScreen");
  loginDiv.style.display = "flex";
  loginDiv.innerHTML = `
    <div style="background:#1e293b;border:1px solid #334155;border-radius:16px;padding:40px 36px;width:340px;box-shadow:0 8px 32px #0008;">
      <div style="text-align:center;margin-bottom:28px;">
        <div style="font-size:36px;">🚗</div>
        <h2 style="color:#38bdf8;margin:8px 0 4px;">DA-Gestion</h2>
        <p style="color:#64748b;font-size:13px;">Connectez-vous pour accéder à l'application</p>
      </div>
      <div style="display:flex;flex-direction:column;gap:14px;">
        <div>
          <label style="font-size:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:5px;">Identifiant</label>
          <input type="text" id="loginInput" placeholder="Votre identifiant" style="width:100%;box-sizing:border-box;"
            onkeydown="if(event.key==='Enter') document.getElementById('passInput').focus()">
        </div>
        <div>
          <label style="font-size:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:5px;">Mot de passe</label>
          <input type="password" id="passInput" placeholder="Votre mot de passe" style="width:100%;box-sizing:border-box;"
            onkeydown="if(event.key==='Enter') tentativeConnexion()">
        </div>
        <div id="loginErreur" style="color:#f87171;font-size:13px;text-align:center;min-height:18px;"></div>
        <button onclick="tentativeConnexion()" style="width:100%;padding:12px;font-size:15px;margin-top:4px;">🔐 Se connecter</button>
      </div>
    </div>`;
  setTimeout(() => document.getElementById("loginInput")?.focus(), 100);
}

function tentativeConnexion(){
  const login = document.getElementById("loginInput")?.value || "";
  const pass  = document.getElementById("passInput")?.value  || "";
  const user  = connecterUtilisateur(login, pass);
  if(user){
    document.getElementById("loginScreen").style.display = "none";
    document.getElementById("appContainer").style.display = "";
    afficherUtilisateurConnecte(user);
    initialiserApplication();
  } else {
    document.getElementById("loginErreur").textContent = "❌ Identifiant ou mot de passe incorrect";
    document.getElementById("passInput").value = "";
    document.getElementById("passInput").focus();
  }
}

function afficherUtilisateurConnecte(user){
  const footer = document.querySelector(".sidebar-footer");
  if(!footer) return;
  footer.innerHTML = `
    <div class="version-info">DA-Gestion v2</div>
    <div style="margin-top:10px;padding:10px;background:#0f172a;border-radius:8px;border:1px solid #1e293b;">
      <div style="font-size:12px;color:#94a3b8;">Connecté en tant que</div>
      <div style="font-weight:bold;color:#38bdf8;font-size:14px;">${escHtml(user.nom)}</div>
      <div style="font-size:11px;color:#7c3aed;">${user.role==="admin" ? "🔑 Administrateur" : "👤 Utilisateur"}</div>
      <button onclick="deconnecterUtilisateur()" class="delete-btn" style="margin-top:8px;width:100%;padding:5px 8px;font-size:12px;">🚪 Déconnexion</button>
    </div>`;

  // Afficher l'onglet Administration uniquement pour les admins
  const lienAdmin = document.getElementById("lienAdmin");
  if(lienAdmin) lienAdmin.style.display = user.role === "admin" ? "" : "none";
}

function ouvrirGestionUtilisateurs(){
  const zone = document.getElementById("detailAssurance") || document.body;
  const users = getUtilisateurs();
  const html = `
    <div class="card" id="gestionUsers">
      <h2>👥 Gestion des utilisateurs</h2>
      <div class="table-wrapper">
        <table>
          <thead><tr><th>Identifiant</th><th>Nom</th><th>Rôle</th><th>Actions</th></tr></thead>
          <tbody>
            ${users.map((u,i) => `<tr>
              <td>${escHtml(u.login)}</td>
              <td>${escHtml(u.nom)}</td>
              <td>${u.role === "admin" ? "🔑 Admin" : "👤 Utilisateur"}</td>
              <td>
                ${i > 0 ? `<button class="delete-btn" onclick="supprimerUtilisateur(${i})">🗑 Supprimer</button>` : "<span style='color:#64748b;font-size:12px;'>Compte principal</span>"}
              </td>
            </tr>`).join("")}
          </tbody>
        </table>
      </div>
      <h3 style="margin-top:20px;">➕ Ajouter un utilisateur</h3>
      <div class="form-grid">
        <input type="text"     id="newLogin"  placeholder="Identifiant">
        <input type="text"     id="newNom"    placeholder="Nom affiché">
        <input type="password" id="newPass"   placeholder="Mot de passe">
        <select id="newRole">
          <option value="utilisateur">👤 Utilisateur</option>
          <option value="admin">🔑 Administrateur</option>
        </select>
        <button onclick="ajouterUtilisateur()">➕ Ajouter</button>
        <button onclick="document.getElementById('gestionUsers').remove()">✖ Fermer</button>
      </div>
    </div>`;
  showPage("assurances");
  setTimeout(() => {
    const det = document.getElementById("detailAssurance");
    if(det){ det.innerHTML = html; det.scrollIntoView({behavior:"smooth"}); }
  }, 100);
}

function renderAdministration(){
  const tbody = document.getElementById("listeUtilisateurs");
  if(!tbody) return;
  const users = getUtilisateurs();
  const session = getSessionUtilisateur();
  tbody.innerHTML = users.map((u,i) => `
    <tr>
      <td><b>${escHtml(u.login)}</b></td>
      <td>${escHtml(u.nom)}</td>
      <td>${u.role === "admin" ? "🔑 Administrateur" : "👤 Utilisateur"}</td>
      <td>
        <input type="password" id="editPass_${i}" placeholder="Nouveau mot de passe" style="width:170px;padding:5px 8px;font-size:12px;">
        <button onclick="changerPassUtilisateur(${i})" style="padding:5px 8px;font-size:12px;">💾</button>
      </td>
      <td>
        ${u.login === session?.login
          ? `<span style="color:#64748b;font-size:12px;">Compte actif</span>`
          : `<button class="delete-btn" onclick="supprimerUtilisateur(${i})">🗑 Supprimer</button>`}
      </td>
    </tr>`).join("");
}

function ajouterUtilisateur(){
  const login = document.getElementById("newLogin")?.value.trim();
  const nom   = document.getElementById("newNom")?.value.trim();
  const pass  = document.getElementById("newPass")?.value.trim();
  const role  = document.getElementById("newRole")?.value;
  if(!login || !nom || !pass){ toast("Tous les champs sont obligatoires", "error"); return; }
  const users = getUtilisateurs();
  if(users.some(u => u.login === login)){ toast("Cet identifiant existe déjà", "error"); return; }
  users.push({ login, motDePasseHash: hashPassword(pass), nom, role });
  saveUtilisateurs(users);
  ["newLogin","newNom","newPass"].forEach(id => { const el=document.getElementById(id); if(el) el.value=""; });
  toast("Utilisateur ajouté ✓");
  renderAdministration();
}

function supprimerUtilisateur(index){
  const users = getUtilisateurs();
  const session = getSessionUtilisateur();
  if(users[index].login === session?.login){ toast("Impossible de supprimer votre propre compte", "error"); return; }
  confirmerAction("Supprimer cet utilisateur ?", ()=>{ const users=getUtilisateurs(); users.splice(index,1); saveUtilisateurs(users); toast("Utilisateur supprimé"); renderAdministration(); });
}

function changerPassUtilisateur(index){
  const input = document.getElementById("editPass_" + index);
  const nouveauPass = input?.value.trim();
  if(!nouveauPass){ toast("Mot de passe vide", "error"); return; }
  const users = getUtilisateurs();
  delete users[index].motDePasse; users[index].motDePasseHash = hashPassword(nouveauPass);
  saveUtilisateurs(users);
  input.value = "";
  toast("Mot de passe modifié ✓");
}

function changerMotDePasse(){
  const ancien    = document.getElementById("ancienPass")?.value;
  const nouveau   = document.getElementById("nouveauPass")?.value;
  const confirmer = document.getElementById("confirmerPass")?.value;
  const session   = getSessionUtilisateur();
  if(!session){ toast("Non connecté", "error"); return; }
  if(nouveau !== confirmer){ toast("Les mots de passe ne correspondent pas", "error"); return; }
  if(!nouveau || nouveau.length < 4){ toast("Mot de passe trop court (min 4 caractères)", "error"); return; }
  const users = getUtilisateurs();
  const idx   = users.findIndex(u => u.login === session.login);
  if(idx < 0 || users[idx].motDePasse !== ancien){ toast("Ancien mot de passe incorrect", "error"); return; }
  users[idx].motDePasse = nouveau;
  saveUtilisateurs(users);
  sessionStorage.setItem("session_user", JSON.stringify(users[idx]));
  ["ancienPass","nouveauPass","confirmerPass"].forEach(id => { const el=document.getElementById(id); if(el) el.value=""; });
  toast("Mot de passe changé avec succès ✓");
}

/* =====================================
   OPR V2 — app-v2.js
===================================== */

/* =====================================
   DONNEES
===================================== */

/* =====================================
   FIREBASE — SYNCHRONISATION MULTI-PC
   
   CONFIGURATION :
   Remplacez les valeurs ci-dessous par
   celles de VOTRE projet Firebase.
   Guide : voir FIREBASE_SETUP.md
===================================== */

/* ── REALTIME DATABASE (europe-west1) ── */
const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyD3x8bNuOfNVhHEe9I50rJTbapgWjerccI",
  authDomain:        "da-gestion.firebaseapp.com",
  databaseURL:       "https://da-gestion-default-rtdb.europe-west1.firebasedatabase.app",
  projectId:         "da-gestion",
  storageBucket:     "da-gestion.firebasestorage.app",
  messagingSenderId: "974588912589",
  appId:             "1:974588912589:web:4eb4ddd8c70d642ddd5a84"
};

let db = null;
let _firebaseActif = false;
let _syncEnCours   = false;

function loadScript(src){
  return new Promise((resolve, reject) => {
    if(document.querySelector(`script[src="${src}"]`)){ resolve(); return; }
    const s = document.createElement("script");
    s.src = src; s.onload = resolve; s.onerror = reject;
    document.head.appendChild(s);
  });
}

function afficherBandeauFirebase(actif){
  const el = document.getElementById("bandeauFirebase");
  if(!el) return;
  if(actif){
    el.innerHTML = `<span style="color:#34d399;">🟢 Sync temps réel actif</span>`;
    el.title = "Données synchronisées entre tous vos PC";
  } else {
    el.innerHTML = `<span style="color:#f59e0b;">💾 Mode local (non synchronisé)</span>`;
    el.title = "Firebase non connecté";
  }
}

/* Convertit un objet Firebase (clé:valeur) en tableau */
function _objVersTableau(obj){
  if(!obj) return [];
  return Object.values(obj);
}

async function initFirebase(){
  try {
    await Promise.all([
      loadScript("https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js"),
      loadScript("https://www.gstatic.com/firebasejs/9.23.0/firebase-database-compat.js")
    ]);

    firebase.initializeApp(FIREBASE_CONFIG);
    db = firebase.database();
    _firebaseActif = true;

    await chargerDepuisFirebase();
    ecouterChangementsFirebase();

    afficherBandeauFirebase(true);

  } catch(e){
    console.warn("⚠️ Firebase erreur :", e.message);
    afficherBandeauFirebase(false);
  }
}

async function chargerDepuisFirebase(){
  if(!db) return;
  try {
    const snap = await db.ref("/").get();
    if(!snap.exists()) return;
    const d = snap.val();

    if(d.clients)           { clients    = _objVersTableau(d.clients);    localStorage.setItem("clients",    JSON.stringify(clients)); }
    if(d.vehicules)         { vehicules  = _objVersTableau(d.vehicules);  localStorage.setItem("vehicules",  JSON.stringify(vehicules)); }
    if(d.dossiers)          { dossiers   = _objVersTableau(d.dossiers);   localStorage.setItem("dossiers",   JSON.stringify(dossiers)); }
    if(d.rendezVous)        { rendezVous = _objVersTableau(d.rendezVous); localStorage.setItem("rendezVous", JSON.stringify(rendezVous)); }
    if(d.assurances)        { assurances = _objVersTableau(d.assurances); localStorage.setItem("assurances", JSON.stringify(assurances)); }
    if(d.documents)         { documents  = _objVersTableau(d.documents);  localStorage.setItem("documents",  JSON.stringify(documents)); }
    if(d.entreprise)        { entreprise = { ...entreprise, ...d.entreprise }; localStorage.setItem("entreprise", JSON.stringify(entreprise)); }
    if(d.dossiersMecanique) {
      if(typeof dossiersMecanique !== "undefined") dossiersMecanique = _objVersTableau(d.dossiersMecanique);
      localStorage.setItem("dossiersMecanique", JSON.stringify(dossiersMecanique));
    }
  } catch(e){
    console.warn("Erreur chargement Firebase :", e.message);
  }
}

function ecouterChangementsFirebase(){
  if(!db) return;
  let premierAppel = true;
  db.ref("/").on("value", snap => {
    if(premierAppel){ premierAppel = false; return; } // ignorer le premier appel (déjà chargé)
    if(_syncEnCours) return;
    if(!snap.exists()) return;
    const d = snap.val();
    if(d.clients)           clients    = _objVersTableau(d.clients);
    if(d.vehicules)         vehicules  = _objVersTableau(d.vehicules);
    if(d.dossiers)          dossiers   = _objVersTableau(d.dossiers);
    if(d.rendezVous)        rendezVous = _objVersTableau(d.rendezVous);
    if(d.assurances)        assurances = _objVersTableau(d.assurances);
    if(d.documents)         documents  = _objVersTableau(d.documents);
    if(d.entreprise)        entreprise = { ...entreprise, ...d.entreprise };
    if(d.dossiersMecanique && typeof dossiersMecanique !== "undefined")
      dossiersMecanique = _objVersTableau(d.dossiersMecanique);
    if(d.utilisateurs){
      const users = _objVersTableau(d.utilisateurs);
      if(users.length > 0){ _utilisateursCache = users; localStorage.setItem("utilisateurs", JSON.stringify(users)); }
    }

    // Rafraîchir l'interface
    renderDossiersRecent();
    renderDossiers();
    renderRendezVous();
    renderRdvDuJour();
    majDashboard();
    if(typeof renderDossiersMecanique === "function"){ renderDossiersMecanique(); majCompteursMecanique(); }
    toast("🔄 Données synchronisées");
  });
}

async function sauvegarderFirebase(){
  if(!db || !_firebaseActif) return;
  _syncEnCours = true;
  try {
    const payload = {
      clients:           clients,
      vehicules:         vehicules,
      dossiers:          dossiers,
      rendezVous:        rendezVous,
      assurances:        assurances,
      documents:         documents,
      entreprise:        entreprise,
      dossiersMecanique: typeof dossiersMecanique !== "undefined" ? dossiersMecanique : [],
      utilisateurs:      getUtilisateurs()
    };
    await db.ref("/").set(payload);
  } catch(e){
    console.warn("⚠️ Erreur sauvegarde Firebase :", e.message);
    toast("⚠️ Sauvegarde locale uniquement", "error");
  } finally {
    setTimeout(()=>{ _syncEnCours = false; }, 1000);
  }
}

let clients   = JSON.parse(localStorage.getItem("clients"))    || [];
let vehicules = JSON.parse(localStorage.getItem("vehicules"))  || [];
let dossiers  = JSON.parse(localStorage.getItem("dossiers"))   || [];
let rendezVous= JSON.parse(localStorage.getItem("rendezVous")) || [];
let assurances= JSON.parse(localStorage.getItem("assurances")) || [];

const assurancesParDefaut = [
  { nom:"AON", telephone:"01 73 10 20 26", email:"sinistrepremium@aon.com / Sinistreparticulier3@aon.com", adresse:"", courtier:"", franchise:"70 € si bris de glace au contrat", declaration:"Déclaration le jour du rendez-vous. Récupérer le numéro de sinistre au téléphone si possible.", documents:"Carte grise, carte verte/mémo, contrôle technique si véhicule de + 4 ans", facturation:"Par mail en indiquant numéro sinistre ou contrat + plaque", relance:"" },
  { nom:"AREAS", telephone:"01 40 17 68 60 / 05 49 18 64 78", email:"", adresse:"49 Rue de Miromesnil 75008 Paris", courtier:"", franchise:"BG 51 € / BGS 55 €", declaration:"Déclaration + cession de créance", documents:"Carte grise, carte verte/mémo, contrôle technique si véhicule de + 4 ans", facturation:"49 Rue de Miromesnil 75008 Paris", relance:"Contacter l’agence au 05 49 18 64 78" },
  { nom:"Abeille Assurance", telephone:"01 71 25 06 25", email:"sinistrebal@abeille-assurance.fr", adresse:"15 Rue du Moulin Bailly 92272 Bois Colombes", courtier:"", franchise:"0 €, sans franchise ou 15% des dommages", declaration:"Accord verbal avec l’agent indiqué sur la carte verte", documents:"Carte grise, carte verte/mémo, contrôle technique si véhicule de + 4 ans", facturation:"15 Rue du Moulin Bailly 92272 Bois Colombes", relance:"Contacter l’agence au 01 71 25 06 25" },
  { nom:"ACM / CIC", telephone:"03 88 14 00 44", email:"constatelauto@acm.fr", adresse:"34 Rue Wacken 67100 Strasbourg", courtier:"", franchise:"0 €, 50 €, 80 €, 100 €", declaration:"Appel pour déclaration le jour du rendez-vous ou via l’application", documents:"Carte grise, carte verte/mémo, contrôle technique si véhicule de + 4 ans", facturation:"34 Rue Wacken 67100 Strasbourg", relance:"03 88 14 00 44" },
  { nom:"ACTIVE ASSU", telephone:"01 75 25 44 73", email:"sinistre@activeassurance.fr", adresse:"Active assurance CS 50222 92271 Boulogne Billancourt Cedex", courtier:"", franchise:"70 € si BDG au contrat", declaration:"Appel pour déclaration le jour du rendez-vous", documents:"Carte grise, carte verte/mémo, contrôle technique si véhicule de + 4 ans", facturation:"Active assurance CS 50222 92271 Boulogne Billancourt Cedex", relance:"01 75 25 44 73" },
  { nom:"AGPM", telephone:"3222", email:"sinistre.auto.pro@agpm.fr", adresse:"Rue Nicolas Appert 83100 Toulon", courtier:"", franchise:"Sans franchise ou 75 €", declaration:"Déclaration + cession de créance", documents:"Carte grise, carte verte/mémo, contrôle technique si véhicule de + 4 ans", facturation:"Rue Nicolas Appert 83100 Toulon", relance:"3222" },
  { nom:"Allianz", telephone:"09 78 97 80 90", email:"monsinistre@allianz.fr / allianzccau@allianz.fr", adresse:"1 cours Michelet CS30051 92076 Paris La Défense", courtier:"", franchise:"0 €, 49 €, 59 €, 69 €, 79 €, 89 €, 99 € ou plus", declaration:"Déclarer le bris de glace le jour du rendez-vous. Sous 48h Allianz envoie au client le numéro de sinistre et le montant", documents:"Carte grise, carte verte/mémo, contrôle technique si véhicule de + 4 ans", facturation:"1 cours Michelet CS30051 92076 Paris La Défense", relance:"09 78 97 80 90" },
  { nom:"APRIL", telephone:"02 99 94 69 75", email:"indemnisation@april-partenaires.fr", adresse:"15 rue Jules Ferry 35303 Fougères", courtier:"", franchise:"0, 80, 90, 100, 110, 150 ou 240 €", declaration:"Déclaration + cession de créance", documents:"Carte grise, carte verte/mémo, contrôle technique si véhicule de + 4 ans", facturation:"15 rue Jules Ferry 35303 Fougères", relance:"02 99 94 69 75" },
  { nom:"ASSU 2000", telephone:"01 48 10 15 00", email:"assu2000@assu2000.com", adresse:"42 avenue de Bobigny 93131 Noisy-le-Sec Cedex", courtier:"", franchise:"0 € ou pas de bris de glace", declaration:"Accord verbal", documents:"Carte grise, carte verte/mémo, contrôle technique si véhicule de + 4 ans", facturation:"42 avenue de Bobigny 93131 Noisy-le-Sec Cedex", relance:"01 48 10 15 00" },
  { nom:"AXA", telephone:"08 21 20 21 80 / 09 70 82 00 18", email:"service.experisebdg@axa.fr", adresse:"313 Terrasse de l’Arche 92727 Nanterre", courtier:"", franchise:"50 € + 10% du montant de la facture, max 210 €", declaration:"Appel avec client obligatoire pour déclaration et obtention du numéro de sinistre", documents:"Carte grise, carte verte/mémo, contrôle technique si véhicule de + 4 ans", facturation:"313 Terrasse de l’Arche 92727 Nanterre", relance:"08 21 20 21 80 / 09 70 82 00 18" },
  { nom:"AXERIA", telephone:"04 27 46 14 00", email:"axeria@axeria-iard.fr / indemnisationauto@axeria-iard.fr", adresse:"27 rue Maurice Flandin CS 53713 69444 Lyon Cedex 03", courtier:"", franchise:"Sans franchise", declaration:"Déclaration + cession de créance", documents:"Carte grise, carte verte/mémo, contrôle technique si véhicule de + 4 ans", facturation:"27 rue Maurice Flandin CS 53713 69444 Lyon Cedex 03", relance:"04 27 46 14 00" },
  { nom:"BPCE / Banque Populaire / Caisse d’Epargne", telephone:"09 69 39 25 52 / 09 69 36 45 45", email:"sinistre@bpce.fr / service-client.auto@bpce.aismail.fr", adresse:"88 Avenue de France 75641 Paris Cedex 13", courtier:"", franchise:"0 €, 60 €, 70 € ou 90 €", declaration:"Mention carte verte ou déclaration logiciel + cession de créance", documents:"Carte grise, carte verte/mémo, contrôle technique si véhicule de + 4 ans", facturation:"88 Avenue de France 75641 Paris Cedex 13", relance:"Mettre en objet le numéro de dossier sinistre" },
  { nom:"Calypso", telephone:"09 78 98 80 90 / 09 78 98 80 98", email:"sinistre@bpce.fr", adresse:"1 Cours Michelet CS 30051 92076 Paris La Défense", courtier:"", franchise:"0 €, 60 €, 70 € ou 90 €", declaration:"Accord verbal", documents:"Carte grise, carte verte/mémo, contrôle technique si véhicule de + 4 ans", facturation:"1 Cours Michelet CS 30051 92076 Paris La Défense", relance:"09 78 98 80 90" },
  { nom:"CARDIF IARD", telephone:"02 27 08 92 92", email:"gestion-bdg@cardif-iard.fr", adresse:"Cardif IARD Indemnisation et service TSA 67492 76934 Rouen Cedex 9", courtier:"", franchise:"0 €, 50 €, 100 €", declaration:"Accord verbal", documents:"Carte grise, carte verte/mémo, contrôle technique si véhicule de + 4 ans", facturation:"TSA 67492 76934 Rouen Cedex 9", relance:"Mettre en objet le numéro de dossier sinistre" },
  { nom:"CARMA ASSURANCE", telephone:"09 74 75 74 74", email:"", adresse:"6 Rue du Marquis de Raies 91008 Evry Cedex", courtier:"", franchise:"0 € ou 60 €", declaration:"Accord verbal", documents:"Carte grise, carte verte/mémo, contrôle technique si véhicule de + 4 ans", facturation:"6 Rue du Marquis de Raies 91008 Evry Cedex", relance:"09 74 75 74 74" },
  { nom:"COVEA", telephone:"Numéro carte verte", email:"", adresse:"86/90 Rue Saint-Lazare 75009 Paris", courtier:"", franchise:"Contacter l’assurance", declaration:"Déclaration + cession de créance", documents:"Carte grise, carte verte/mémo, contrôle technique si véhicule de + 4 ans", facturation:"86/90 Rue Saint-Lazare 75009 Paris", relance:"Contacter la compagnie au numéro de la carte verte" },
  { nom:"DIRECT ASSURANCE", telephone:"09 70 80 80 01 / 01 46 14 44 14", email:"contat.sinistre@avanssur.fr", adresse:"33 Rue de Verdun / 48 Rue Carnot, immeuble Le Verdi 92150 Suresnes", courtier:"", franchise:"25% du montant des travaux", declaration:"Déclaration de sinistre avec assuré pour obtenir le numéro avant intervention + chèque de caution", documents:"Carte grise, carte verte/mémo, contrôle technique si véhicule de + 4 ans", facturation:"33 Rue de Verdun / 48 Rue Carnot 92150 Suresnes", relance:"01 46 14 44 14" },
  { nom:"EURO ASSURANCE", telephone:"01 49 15 74 00", email:"info@eamail.fr", adresse:"6 Rue Gracchus Babeuf 93130 Noisy-le-Sec", courtier:"", franchise:"0 € ou 80 €", declaration:"Déclaration + cession de créance", documents:"Carte grise, carte verte/mémo, contrôle technique si véhicule de + 4 ans", facturation:"6 Rue Gracchus Babeuf 93130 Noisy-le-Sec", relance:"01 49 15 74 00" },
  { nom:"GAN", telephone:"0800 020 014", email:"materiel.auto@gan.fr", adresse:"8/10 Rue d’Astorg 75008 Paris", courtier:"", franchise:"0 € à 100 €", declaration:"Déclaration + cession de créance", documents:"Carte grise, carte verte/mémo, contrôle technique si véhicule de + 4 ans", facturation:"8/10 Rue d’Astorg 75008 Paris", relance:"0800 020 014" },
  { nom:"GMF", telephone:"02 56 90 74 83 / 09 74 87 87 83 / 09 70 83 02 71", email:"indemnisation.auto@gmf.fr", adresse:"148 Rue Anatole France 92300 Levallois Perret", courtier:"", franchise:"0 €, 45 €, 53 €, 60 €", declaration:"Accord verbal", documents:"Carte grise, carte verte/mémo, contrôle technique si véhicule de + 4 ans", facturation:"148 Rue Anatole France 92300 Levallois Perret", relance:"Présence du client recommandée" },
  { nom:"GRAS SAVOYE", telephone:"01 84 94 01 14", email:"sinautos.nord@grassavoye.com", adresse:"Immeuble Quai 33, 33 Quai de Dion-Bouton CS 70001 92814 Puteaux Cedex", courtier:"", franchise:"Généralement sans franchise à confirmer", declaration:"Appeler la compagnie pour numéro accord, faire un devis, prise en charge sous 48h", documents:"Carte grise, carte verte/mémo, contrôle technique si véhicule de + 4 ans", facturation:"33 Quai de Dion-Bouton CS 70001 92814 Puteaux Cedex", relance:"01 84 94 01 14" },
  { nom:"GENERALI", telephone:"01 58 38 59 00 / 09 70 80 60 01", email:"indemnisation.auto.diret@generali.fr", adresse:"2 Rue Pillet Will 75009 Paris", courtier:"", franchise:"0, 52, 62, 70, 73, 75, 80, 83, 94, 100, 104 €", declaration:"Déclaration + cession de créance", documents:"Carte grise, carte verte/mémo, contrôle technique si véhicule de + 4 ans", facturation:"2 Rue Pillet Will 75009 Paris", relance:"01 58 38 59 00 / 09 70 80 60 01" },
  { nom:"GROUPAMA", telephone:"Selon région", email:"auto@groupama-ne.fr", adresse:"Adresses régionales selon contrat", courtier:"", franchise:"0 €, 76,96 €, 77,27 €, 78,48 €", declaration:"Déclaration + cession de créance", documents:"Carte grise, carte verte/mémo, contrôle technique si véhicule de + 4 ans", facturation:"Selon région Groupama", relance:"Contacter la région concernée" },
  { nom:"JB LABALETTE", telephone:"01 47 73 74 80 / 01 40 73 74 80", email:"sinistre@labalette.fr", adresse:"39/41 Rue Washington 75008 Paris", courtier:"", franchise:"0 € à 100 €", declaration:"Appeler pour accord de prise en charge + envoyer devis pendant l’appel", documents:"Carte grise, carte verte/mémo, contrôle technique si véhicule de + 4 ans", facturation:"39/41 Rue Washington 75008 Paris", relance:"01 40 73 74 80" },
  { nom:"LA BANQUE POSTALE", telephone:"02 28 09 42 00", email:"service.sinistre@labanquepostale-assurance-iard.fr", adresse:"30 Boulevard Gallieni 92130 Issy-les-Moulineaux", courtier:"", franchise:"0 €, 58 €, 74 €, 82 €, 90 € écrit sur carte verte", declaration:"Déclaration + cession de créance", documents:"Carte grise, carte verte/mémo, contrôle technique si véhicule de + 4 ans", facturation:"30 Boulevard Gallieni 92130 Issy-les-Moulineaux", relance:"02 28 09 42 00" },
  { nom:"L'AUXILIAIRE BTP", telephone:"01 48 10 15 00", email:"", adresse:"50 Cours Franklin Roosevelt BP 6402 69413 Lyon Cedex", courtier:"", franchise:"Sans franchise à confirmer par téléphone", declaration:"Déclaration + cession de créance", documents:"Carte grise, carte verte/mémo, contrôle technique si véhicule de + 4 ans", facturation:"50 Cours Franklin Roosevelt BP 6402 69413 Lyon Cedex", relance:"01 48 10 15 00" },
  { nom:"LEOCARE", telephone:"", email:"sinistre@leocare.fr", adresse:"", courtier:"", franchise:"", declaration:"Déclaration + cession de créance", documents:"Carte grise, carte verte/mémo, contrôle technique si véhicule de + 4 ans", facturation:"", relance:"" },
  { nom:"L'EQUITE", telephone:"01 58 38 10 10", email:"", adresse:"2 Rue Pillet Will 75009 Paris", courtier:"", franchise:"Sans franchise à confirmer par téléphone", declaration:"Déclaration + cession de créance", documents:"Carte grise, carte verte/mémo, contrôle technique si véhicule de + 4 ans", facturation:"2 Rue Pillet Will 75009 Paris", relance:"01 58 38 10 10" },
  { nom:"L'OLIVIER ASSURANCE", telephone:"01 84 02 20 22 / 09 70 26 60 11", email:"sinistre@lolivier.fr", adresse:"9-10 Rue l’Abbé Stahl 59700 Marcq-en-Barœul", courtier:"", franchise:"0, 60, 70, 75, 80, 85, 90, 95, 100 €", declaration:"Accord verbal. Le client appelle pour déclarer + numéro de sinistre + chèque caution", documents:"Carte grise, carte verte/mémo, contrôle technique si véhicule de + 4 ans", facturation:"9-10 Rue l’Abbé Stahl 59700 Marcq-en-Barœul", relance:"09 70 26 60 11" },
  { nom:"MAAF", telephone:"3015 / 02 28 01 12 12 / 09 69 39 00 91", email:"service-client.auto@maaf.fr", adresse:"Chaban 79180 Chauray", courtier:"", franchise:"Bris de glace 20011 : oui = 75 €, non = 0 €. Pas de mention = pas d’assurance BDG", declaration:"Déclaration + cession de créance", documents:"Carte grise, carte verte/mémo, contrôle technique si véhicule de + 4 ans", facturation:"Chaban 79180 Chauray", relance:"02 28 01 12 12 / 09 69 39 00 91" },
  { nom:"MACIF", telephone:"09 69 39 49 49", email:"relationgestion@macif.fr", adresse:"2-4 Rue du Pied de Fond 79000 Niort", courtier:"", franchise:"0, 60, 80, 100 €", declaration:"Accord verbal", documents:"Carte grise, carte verte/mémo, contrôle technique si véhicule de + 4 ans", facturation:"2-4 Rue du Pied de Fond 79000 Niort", relance:"09 69 39 49 49" },
  { nom:"MACSF", telephone:"01 71 14 32 33", email:"sinauto@macsf.fr", adresse:"10 Cours du Triangle de l’Arche 92919 La Défense Cedex", courtier:"", franchise:"BG 0 € SF / BGA ou BGF 38 € / BGB 50 € / BGC 75 €", declaration:"Déclaration + cession de créance + chèque de caution + facture acquittée", documents:"Carte grise, carte verte/mémo, contrôle technique si véhicule de + 4 ans", facturation:"10 Cours du Triangle de l’Arche 92919 La Défense Cedex", relance:"01 71 14 32 33" },
  { nom:"MAIF", telephone:"03 27 28 13 60", email:"gestionsinistre@maif.fr", adresse:"200 Avenue Salvador Allende 79000 Niort", courtier:"", franchise:"L = 0 € / S et D = 50 € / I = pas d’assurance BDG", declaration:"Déclaration + cession de créance", documents:"Carte grise, carte verte/mémo, contrôle technique si véhicule de + 4 ans", facturation:"200 Avenue Salvador Allende 79000 Niort", relance:"03 27 28 13 60" },
  { nom:"MATMUT", telephone:"02 35 03 68 68", email:"", adresse:"Groupe Matmut 66 Rue de Sotteville 76100 Rouen", courtier:"", franchise:"H = 15% facture / HPB = 25% pare-brise / HSF = 0 € / HPB SF = pare-brise sans franchise", declaration:"Déclaration + cession de créance", documents:"Carte grise, carte verte/mémo, contrôle technique si véhicule de + 4 ans", facturation:"66 Rue de Sotteville 76100 Rouen", relance:"02 35 03 68 68" },
  { nom:"MARSCH", telephone:"01 41 34 50 00", email:"facture.auto@marsch.com", adresse:"5 Place de la Pyramide 92800 Puteaux", courtier:"", franchise:"Sans franchise à confirmer", declaration:"Déclaration + cession de créance", documents:"Carte grise, carte verte/mémo, contrôle technique si véhicule de + 4 ans", facturation:"5 Place de la Pyramide 92800 Puteaux", relance:"01 41 34 50 00" },
  { nom:"MMA", telephone:"09 80 98 09 11 / 09 69 32 94 31", email:"gestionbdg@groupe-mma.fr", adresse:"14 Boulevard Marie et Alexandre Oyon 72030 Le Mans Cedex 9", courtier:"", franchise:"0, 50, 80, 100 €", declaration:"Accord verbal", documents:"Carte grise, carte verte/mémo, contrôle technique si véhicule de + 4 ans", facturation:"14 Boulevard Marie et Alexandre Oyon 72030 Le Mans Cedex 9", relance:"09 80 98 09 11 / flotte 09 69 32 94 31" },
  { nom:"MUTUELLE DE POITIERS", telephone:"", email:"", adresse:"Lieu dit Bois du Fief Clairet 86240 Ligugé", courtier:"", franchise:"Voir assurance", declaration:"Déclaration + cession de créance", documents:"Carte grise, carte verte/mémo, contrôle technique si véhicule de + 4 ans", facturation:"Lieu dit Bois du Fief Clairet 86240 Ligugé", relance:"" },
  { nom:"NETVOX", telephone:"01 76 29 76 30", email:"sinistre@netvox-assurance.com", adresse:"153 Rue de Guise 02100 Saint Quentin", courtier:"", franchise:"80 € si Confort ou Sérénité souscrit", declaration:"Déclaration + cession de créance", documents:"Carte grise, carte verte/mémo, contrôle technique si véhicule de + 4 ans", facturation:"153 Rue de Guise 02100 Saint Quentin", relance:"01 76 29 76 30" },
  { nom:"PACIFICA", telephone:"08 00 81 08 12", email:"Suivant la déclaration", adresse:"8/10 Boulevard de Vaugirard 75724 Paris Cedex 15", courtier:"", franchise:"Bris de glace 0 €", declaration:"Déclaration + cession de créance + appel assurance pour numéro de sinistre", documents:"Carte grise, carte verte/mémo, contrôle technique si véhicule de + 4 ans", facturation:"8/10 Boulevard de Vaugirard 75724 Paris Cedex 15", relance:"08 00 81 08 12" },
  { nom:"SERENIS", telephone:"03 88 14 00 44", email:"Suivant la déclaration", adresse:"25 Rue du Docteur Henri Abel 26000 Valence", courtier:"", franchise:"Sans franchise, 50, 80, 100 €", declaration:"Déclaration + cession de créance", documents:"Carte grise, carte verte/mémo, contrôle technique si véhicule de + 4 ans", facturation:"25 Rue du Docteur Henri Abel 26000 Valence", relance:"03 88 14 00 44" },
  { nom:"SURAVENIR", telephone:"09 70 80 64 64 / 09 70 80 94 07", email:"indemnisation@suravenir-assurances.fr", adresse:"", courtier:"", franchise:"Mention BDGXXX ou XXX = montant franchise", declaration:"Déclaration + cession de créance", documents:"Carte grise, carte verte/mémo, contrôle technique si véhicule de + 4 ans", facturation:"", relance:"09 70 80 64 64 / 09 70 80 94 07" },
  { nom:"SOGESSUR", telephone:"09 69 32 73 26", email:"monsinistre@sgassurances.com", adresse:"17 Bis Place des Reflets 92400 Courbevoie", courtier:"", franchise:"G = 20% facture max 80 € / O = 0 €", declaration:"Déclaration + cession de créance", documents:"Carte grise, carte verte/mémo, contrôle technique si véhicule de + 4 ans", facturation:"17 Bis Place des Reflets 92400 Courbevoie", relance:"09 69 32 73 26" },
  { nom:"SWISSLIFE", telephone:"03 20 45 73 00", email:"sinistre.auto@swisslife.fr", adresse:"7 Rue Belgrand 92300 Levallois Perret", courtier:"", franchise:"R-BGO = 0 € chez prestataire agréé, sinon voir assurance", declaration:"Appeler le numéro de l’agence du client sur le mémo assurance pour accord", documents:"Carte grise, carte verte/mémo, contrôle technique si véhicule de + 4 ans", facturation:"7 Rue Belgrand 92300 Levallois Perret", relance:"Carte verte" },
  { nom:"VERSPIEREN", telephone:"09 69 32 73 26 / 03 20 66 86 13", email:"hbouchlaghem@verspieren.com / speirenboom@verspieren.com / mdormoy@verspieren.com", adresse:"7 Bis Place des Reflets 92400 Courbevoie", courtier:"", franchise:"G = 20% de la facture", declaration:"Déclaration + cession de créance", documents:"Carte grise, carte verte/mémo, contrôle technique si véhicule de + 4 ans", facturation:"7 Bis Place des Reflets 92400 Courbevoie", relance:"09 69 32 73 26" },
  { nom:"ZEPHIR", telephone:"02 40 55 70 65", email:"sinistreclient@groupe-zephyr.fr", adresse:"Rue du Président Wilson CS 10137 44144 Châteaubriant", courtier:"", franchise:"0, 80, 90, 100, 130, 140, 160, 240 €", declaration:"Accord verbal", documents:"Carte grise, carte verte/mémo, contrôle technique si véhicule de + 4 ans", facturation:"Rue du Président Wilson CS 10137 44144 Châteaubriant", relance:"02 40 55 70 65" }
];

function normaliserCleAssurance(nom){
  return String(nom||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "").trim();
}

function getToutesAssurances(){
  const map = new Map();
  [...assurancesParDefaut, ...assurances].forEach(a => {
    if(a && a.nom) map.set(normaliserCleAssurance(a.nom), a);
  });
  return Array.from(map.values()).sort((a,b)=>a.nom.localeCompare(b.nom, "fr"));
}

function trouverAssurance(nom){
  const cle = normaliserCleAssurance(nom);
  if(!cle) return null;
  return getToutesAssurances().find(a => normaliserCleAssurance(a.nom) === cle || normaliserCleAssurance(a.nom).includes(cle) || cle.includes(normaliserCleAssurance(a.nom)));
}

let entreprise = JSON.parse(localStorage.getItem("entreprise")) || {
  nom:"", adresse:"", telephone:"", email:"", siret:"", logo:""
};

/* =====================================
   SAUVEGARDE
===================================== */

let _dataSaved = true;

function saveData(){
  localStorage.setItem("clients",    JSON.stringify(clients));
  localStorage.setItem("vehicules",  JSON.stringify(vehicules));
  localStorage.setItem("dossiers",   JSON.stringify(dossiers));
  localStorage.setItem("rendezVous", JSON.stringify(rendezVous));
  localStorage.setItem("assurances", JSON.stringify(assurances));
  localStorage.setItem("entreprise", JSON.stringify(entreprise));
  localStorage.setItem("dossiersMecanique", JSON.stringify(typeof dossiersMecanique!=="undefined"?dossiersMecanique:[]));
  if(typeof tarifsMecanique!=="undefined") localStorage.setItem("tarifsMecanique", JSON.stringify(tarifsMecanique));
  _dataSaved = true;
  const ind = document.getElementById("indicateurSauvegarde");
  if(ind){ ind.style.display="none"; }
  // Synchroniser sur Firebase si actif
  if(_firebaseActif) sauvegarderFirebase();
}

function marquerNonSauvegarde(){
  _dataSaved = false;
  const ind = document.getElementById("indicateurSauvegarde");
  if(ind){ ind.style.display="flex"; }
}

window.addEventListener("beforeunload", function(e){
  if(!_dataSaved){ e.preventDefault(); e.returnValue="Des données non sauvegardées seront perdues."; }
});


/* =====================================
   NUMEROTATION DOSSIERS / CLIENTS AUTO
===================================== */

function nettoyerNomClient(nom){
  return String(nom || "").trim().replace(/\s+/g, " ");
}

function clientExiste(nom){
  const n = nettoyerNomClient(nom).toLowerCase();
  if(!n) return true;
  return clients.some(c => nettoyerNomClient(((c.nom||"") + " " + (c.prenom||"")).trim()).toLowerCase() === n || nettoyerNomClient(c.nom).toLowerCase() === n);
}

function ajouterClientDepuisDossier(dossier){
  const nomComplet = nettoyerNomClient(dossier.client);
  if(!nomComplet || clientExiste(nomComplet)) return false;
  clients.push({ nom: nomComplet, prenom: "", telephone: dossier.telephone || "" });
  return true;
}

function synchroniserClientsDepuisDossiers(){
  let ajoute = false;
  dossiers.forEach(d => { if(ajouterClientDepuisDossier(d)) ajoute = true; });
  if(ajoute) saveData();
}

function normaliserNumerosDossiers(){
  let prochain = 1;
  dossiers.forEach(d => {
    const n = parseInt(String(d.numero || "").trim(), 10);
    if(!isNaN(n) && n >= prochain) prochain = n + 1;
  });

  let modifie = false;
  dossiers.forEach(d => {
    const numeroActuel = String(d.numero || "").trim();
    if(!/^\d+$/.test(numeroActuel)){
      d.numero = String(prochain++);
      modifie = true;
    }
  });

  const stocke = parseInt(localStorage.getItem("prochainNumeroDossier") || "0", 10);
  if(isNaN(stocke) || stocke < prochain){
    localStorage.setItem("prochainNumeroDossier", String(prochain));
  }

  if(modifie) saveData();
}

function getProchainNumeroDossier(){
  normaliserNumerosDossiers();
  let prochain = parseInt(localStorage.getItem("prochainNumeroDossier") || "1", 10);
  if(isNaN(prochain) || prochain < 1) prochain = 1;
  localStorage.setItem("prochainNumeroDossier", String(prochain + 1));
  return String(prochain);
}

/* =====================================
   MODAL SYSTÈME
===================================== */

function ouvrirModal(titre, contenuHtml, onConfirm){
  document.getElementById("modalTitre").textContent  = titre;
  document.getElementById("modalCorps").innerHTML    = contenuHtml;
  document.getElementById("modalOverlay").style.display = "flex";
  document.getElementById("modalBtnOk").onclick = function(){
    const res = onConfirm ? onConfirm() : true;
    if(res !== false) fermerModal();
  };
  setTimeout(()=>{ document.querySelector("#modalCorps input")?.focus(); }, 80);
}

function fermerModal(){
  document.getElementById("modalOverlay").style.display = "none";
  document.getElementById("modalCorps").innerHTML = "";
}

function confirmerAction(message, onOui){
  document.getElementById("modalTitre").textContent = "⚠️ Confirmation";
  document.getElementById("modalCorps").innerHTML = `<p style="font-size:15px;color:#f1f5f9;line-height:1.6;">${message}</p>`;
  document.getElementById("modalOverlay").style.display = "flex";
  document.getElementById("modalBtnOk").textContent = "✅ Confirmer";
  document.getElementById("modalBtnOk").style.background = "#ef4444";
  document.getElementById("modalBtnOk").onclick = function(){
    fermerModal();
    document.getElementById("modalBtnOk").textContent = "💾 Enregistrer";
    document.getElementById("modalBtnOk").style.background = "";
    onOui();
  };
}

/* =====================================
   TOAST NOTIFICATION
===================================== */

function toast(message, type="success"){
  const existing = document.querySelector(".toast");
  if(existing) existing.remove();

  const el = document.createElement("div");
  el.className = "toast" + (type === "error" ? " error" : "");
  el.textContent = message;
  document.body.appendChild(el);

  setTimeout(()=>{ if(el.parentNode) el.remove(); }, 3000);
}


function rechercheGlobale(terme){
  if(!terme || terme.length < 2){ document.getElementById("resultatsRecherche").style.display="none"; return; }
  const t = terme.toLowerCase();
  const resultats = [];

  dossiers.forEach((d,i)=>{
    const texte = `${d.numero} ${d.client} ${d.vehicule} ${d.immat} ${d.sinistre} ${d.assurance}`.toLowerCase();
    if(texte.includes(t)) resultats.push({ type:"📁 Dossier", label:`N°${d.numero} — ${d.client} — ${d.vehicule} (${d.immat||"—"})`, action:`ouvrirDossier(${i})` });
  });
  clients.forEach((c,i)=>{
    const texte = `${c.nom} ${c.prenom} ${c.telephone}`.toLowerCase();
    if(texte.includes(t)) resultats.push({ type:"👤 Client", label:`${c.nom} ${c.prenom||""} — ${c.telephone||""}`, action:`showPage('clients')` });
  });
  vehicules.forEach((v,i)=>{
    const texte = `${v.marque} ${v.modele} ${v.immat}`.toLowerCase();
    if(texte.includes(t)) resultats.push({ type:"🚗 Véhicule", label:`${v.marque} ${v.modele} — ${v.immat}`, action:`showPage('vehicules')` });
  });
  documents.forEach((d,i)=>{
    const texte = `${d.id} ${d.titre} ${d.dossierNumero}`.toLowerCase();
    if(texte.includes(t)) resultats.push({ type:"🧾 Document", label:`${d.id} — ${d.titre||""} — ${d.totalTTC.toLocaleString("fr-FR",{minimumFractionDigits:2})} €`, action:`chargerDocument(${i});showPage('devisFacture')` });
  });
  // Recherche dans dossiers mécanique
  if(typeof dossiersMecanique !== "undefined"){
    dossiersMecanique.forEach((d,i)=>{
      const texte = `${d.numero} ${d.client} ${d.vehicule||""} ${d.immat||""} ${d.typePanne||""} ${d.technicien||""}`.toLowerCase();
      if(texte.includes(t)) resultats.push({ type:"🔩 Mécanique", label:`${d.numero} — ${d.client} — ${d.vehicule||"—"} (${d.immat||"—"}) — ${d.typePanne||""}`, action:`ouvrirOrdreReparation(${i});showPage('mecanique')` });
    });
  }

  const zone = document.getElementById("resultatsRecherche");
  if(resultats.length === 0){
    zone.innerHTML = `<div style="padding:12px 16px;color:#64748b;font-size:13px;">Aucun résultat pour "${escHtml(terme)}"</div>`;
  } else {
    zone.innerHTML = resultats.slice(0,8).map(r=>`
      <div onclick="${r.action};fermerRecherche()" style="padding:10px 16px;cursor:pointer;border-bottom:1px solid #1e293b;display:flex;gap:10px;align-items:center;" onmouseover="this.style.background='#1e293b'" onmouseout="this.style.background=''">
        <span style="font-size:11px;color:#64748b;min-width:90px;">${r.type}</span>
        <span style="font-size:13px;">${escHtml(r.label)}</span>
      </div>`).join("");
  }
  zone.style.display = "";
}

function fermerRecherche(){
  document.getElementById("rechercheGlobaleInput").value = "";
  document.getElementById("resultatsRecherche").style.display = "none";
}

/* =====================================
   NAVIGATION
===================================== */

function showPage(pageId){
  if(pageId === "administration") renderAdministration();
  if(pageId === "agenda") { renderCalendrierRdv(); renderRendezVous(); renderCalendrierMensuel(); }
  if(pageId === "mecanique") { setTimeout(()=>{ renderDossiersMecanique(); majCompteursMecanique(); remplirTarifsMecanique(); }, 0); }
  if(pageId === "dashboardMecanique") { setTimeout(()=>{ renderDashboardMecanique(); }, 0); }
  if(pageId === "devisFacture") { setTimeout(()=>{ majNumeroDocument(); }, 100); }
  if(pageId === "relancesAssurance") { setTimeout(()=>{ initRelancesAssurance(); }, 0); }
  document.querySelectorAll(".page").forEach(p => p.classList.add("hidden"));
  const page = document.getElementById(pageId);
  if(page) page.classList.remove("hidden");
}

function setActive(link){
  document.querySelectorAll(".sidebar nav a").forEach(a => a.classList.remove("active"));
  link.classList.add("active");
}

/* =====================================
   DASHBOARD
===================================== */

function majDashboard(){
  let totalCA = 0;
  dossiers.forEach(d => { totalCA += Number(d.facture || 0); });
  if(typeof dossiersMecanique !== "undefined"){
    dossiersMecanique.forEach(d => { recalculerTotauxMecanique(d); totalCA += Number(d.facture || d.devis || 0); });
  }

  const set = (id, val) => {
    const el = document.getElementById(id);
    if(el) el.textContent = val;
  };

  set("totalDossiers", dossiers.length + (typeof dossiersMecanique !== "undefined" ? dossiersMecanique.length : 0));
  set("totalClients",  clients.length);
  set("totalVehicules",vehicules.length);
  set("caMois", totalCA.toLocaleString("fr-FR") + " €");

  majCompteursDossiers();
  renderStatistiques();
  renderGraphiqueMensuel();
  renderGraphiqueCAMensuel();
  renderTopClients();
  renderAlertesRetard();
  majDashboardVitrageMeca();
  if(typeof majBadgeRelances === "function") majBadgeRelances();
}

/* =====================================
   COMPTEURS STATUTS
===================================== */

function majCompteursDossiers(){
  let attente=0, encours=0, termine=0, facture=0;
  const tousDossiersDashboard = [...dossiers, ...(typeof dossiersMecanique !== "undefined" ? dossiersMecanique : [])];
  tousDossiersDashboard.forEach(d=>{
    if(d.statut==="En attente") attente++;
    if(d.statut==="En cours")   encours++;
    if(d.statut==="Terminé")    termine++;
    if(d.statut==="Facturé")    facture++;
  });

  const set = (id, val) => { const el=document.getElementById(id); if(el) el.textContent=val; };
  set("compteurAttente", attente);
  set("compteurEncours", encours);
  set("compteurTermine", termine);
  set("compteurFacture", facture);
}

/* =====================================
   STATISTIQUES
===================================== */

function renderStatistiques(){
  renderStatsAssurances();
  renderStatsVitrages();
}


function renderGraphiqueMensuel(){
  const canvas = document.getElementById("graphiqueMensuel");
  if(!canvas) return;
  const ctx = canvas.getContext("2d");

  const maintenant = new Date();
  const mois = [];
  for(let i=5; i>=0; i--){
    const d = new Date(maintenant.getFullYear(), maintenant.getMonth()-i, 1);
    mois.push({ label: d.toLocaleDateString("fr-FR",{month:"short",year:"2-digit"}), annee: d.getFullYear(), mois: d.getMonth() });
  }

  const comptages = mois.map(m => dossiers.filter(d=>{
    const date = new Date(d.dateCreation||d.date||"");
    return date.getFullYear()===m.annee && date.getMonth()===m.mois;
  }).length);

  const ca = mois.map(m => dossiers.filter(d=>{
    const date = new Date(d.dateCreation||d.date||"");
    return date.getFullYear()===m.annee && date.getMonth()===m.mois;
  }).reduce((acc,d)=> acc + Number(d.facture||0), 0));

  const maxVal = Math.max(...comptages, 1);
  const w = canvas.width, h = canvas.height;
  const pad = { top:20, right:20, bottom:40, left:40 };
  const barW = Math.floor((w - pad.left - pad.right) / mois.length * 0.5);
  const barGap = Math.floor((w - pad.left - pad.right) / mois.length);

  ctx.clearRect(0,0,w,h);

  // Fond grille
  ctx.strokeStyle = "#1e293b"; ctx.lineWidth = 1;
  for(let i=0;i<=4;i++){
    const y = pad.top + (h-pad.top-pad.bottom)/4*i;
    ctx.beginPath(); ctx.moveTo(pad.left,y); ctx.lineTo(w-pad.right,y); ctx.stroke();
  }

  // Barres
  mois.forEach((m,i)=>{
    const x = pad.left + i*barGap + barGap/2 - barW/2;
    const barH = ((h-pad.top-pad.bottom) * (comptages[i]/maxVal));
    const y = h - pad.bottom - barH;
    const grad = ctx.createLinearGradient(x, y, x, h-pad.bottom);
    grad.addColorStop(0,"#38bdf8"); grad.addColorStop(1,"#2563eb44");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(x,y,barW,barH,4) : ctx.rect(x,y,barW,barH);
    ctx.fill();
    // Label valeur
    if(comptages[i]>0){
      ctx.fillStyle="#f1f5f9"; ctx.font="bold 11px sans-serif"; ctx.textAlign="center";
      ctx.fillText(comptages[i], x+barW/2, y-5);
    }
    // Label mois
    ctx.fillStyle="#64748b"; ctx.font="11px sans-serif"; ctx.textAlign="center";
    ctx.fillText(m.label, x+barW/2, h-pad.bottom+16);
  });
}

function renderStatsAssurances(){
  const zone = document.getElementById("statsAssurances");
  if(!zone) return;

  const comptage = {};
  dossiers.forEach(d=>{
    if(d.assurance){ comptage[d.assurance] = (comptage[d.assurance]||0)+1; }
  });

  const total = dossiers.length || 1;
  const sorted = Object.entries(comptage).sort((a,b)=>b[1]-a[1]).slice(0,5);

  if(sorted.length === 0){
    zone.innerHTML = "<p style='color:var(--muted);font-size:13px;'>Aucune donnée</p>";
    return;
  }

  zone.innerHTML = sorted.map(([nom, nb])=>`
    <div class="stat-item">
      <div class="stat-label"><span>${nom}</span><strong>${nb}</strong></div>
      <div class="progress"><div class="progress-bar" style="width:${Math.round(nb/total*100)}%"></div></div>
    </div>
  `).join("");
}

function renderStatsVitrages(){
  const zone = document.getElementById("statsVitrages");
  if(!zone) return;

  const comptage = {};
  dossiers.forEach(d=>{
    if(d.vitrage){ comptage[d.vitrage] = (comptage[d.vitrage]||0)+1; }
  });

  const total = dossiers.length || 1;
  const sorted = Object.entries(comptage).sort((a,b)=>b[1]-a[1]).slice(0,5);

  if(sorted.length === 0){
    zone.innerHTML = "<p style='color:var(--muted);font-size:13px;'>Aucune donnée</p>";
    return;
  }

  zone.innerHTML = sorted.map(([nom, nb])=>`
    <div class="stat-item">
      <div class="stat-label"><span>${nom}</span><strong>${nb}</strong></div>
      <div class="progress"><div class="progress-bar" style="width:${Math.round(nb/total*100)}%;background:linear-gradient(90deg,#2563eb,#38bdf8)"></div></div>
    </div>
  `).join("");
}

/* =====================================
   MARQUES / MODELES
===================================== */

const modelesParMarque = {
  "Renault":    ["Clio","Captur","Mégane","Scénic","Austral","Kadjar","Twingo","Autre"],
  "Peugeot":    ["108","208","308","508","2008","3008","5008","Autre"],
  "Citroën":    ["C1","C3","C4","C5 Aircross","Berlingo","Autre"],
  "Dacia":      ["Sandero","Duster","Jogger","Logan","Autre"],
  "Toyota":     ["Yaris","Corolla","C-HR","RAV4","Autre"],
  "Volkswagen": ["Polo","Golf","T-Roc","Tiguan","Autre"],
  "BMW":        ["Série 1","Série 2","Série 3","X1","X3","X5","Autre"],
  "Audi":       ["A1","A3","A4","A5","Q2","Q3","Q5","Autre"],
  "Mercedes-Benz":["Classe A","Classe B","Classe C","GLA","GLC","Autre"]
};

function chargerModeles(){
  const marque      = document.getElementById("marqueVehicule").value;
  const select      = document.getElementById("modeleVehicule");
  const autreMarque = document.getElementById("autreMarque");
  const autreModele = document.getElementById("autreModele");

  if(marque === "Autre..."){
    if(autreMarque) autreMarque.style.display = "block";
    if(autreModele) autreModele.style.display = "block";
    if(select)      select.style.display       = "none";
    return;
  }

  if(autreMarque) autreMarque.style.display = "none";
  if(autreModele) autreModele.style.display = "none";
  if(select)      select.style.display       = "block";

  select.innerHTML = '<option value="">Choisir un modèle</option>';
  if(!modelesParMarque[marque]) return;

  modelesParMarque[marque].forEach(modele=>{
    const opt = document.createElement("option");
    opt.value = modele;
    opt.textContent = modele;
    select.appendChild(opt);
  });
}

/* =====================================
   GESTION VEHICULES
===================================== */

function ajouterVehicule(){
  let marque = document.getElementById("marqueVehicule").value;
  let modele = document.getElementById("modeleVehicule")?.value || "";
  let immat  = document.getElementById("immatVehicule").value.trim();

  if(marque === "Autre..."){
    marque = document.getElementById("autreMarque")?.value.trim() || "";
    modele = document.getElementById("autreModele")?.value.trim() || "";
  }

  if(!marque){ toast("Choisissez une marque", "error"); return; }
  if(!immat){  toast("Saisissez l'immatriculation", "error"); return; }

  vehicules.push({ marque, modele, immat });
  saveData();
  renderVehicules();
  majDashboard();

  document.getElementById("marqueVehicule").value = "";
  document.getElementById("modeleVehicule").innerHTML = '<option value="">Choisir un modèle</option>';
  document.getElementById("immatVehicule").value = "";
  const am = document.getElementById("autreMarque");
  const ao = document.getElementById("autreModele");
  if(am){ am.value=""; am.style.display="none"; }
  if(ao){ ao.value=""; ao.style.display="none"; }

  toast("Véhicule ajouté ✓");
}

function supprimerVehicule(index){
  confirmerAction("Supprimer ce véhicule ?", ()=>{ vehicules.splice(index,1); saveData(); renderVehicules(); majDashboard(); toast("Véhicule supprimé"); });
}

function modifierVehicule(index){
  const v = vehicules[index];
  const esc = x => (x||"").replace(/"/g,"&quot;");
  ouvrirModal("✏️ Modifier le véhicule", `
    <div class="form-grid">
      <input type="text" id="mv_marque" value="${esc(v.marque)}" placeholder="Marque">
      <input type="text" id="mv_modele" value="${esc(v.modele)}" placeholder="Modèle">
      <input type="text" id="mv_immat"  value="${esc(v.immat)}"  placeholder="Immatriculation" style="text-transform:uppercase;">
      <input type="text" id="mv_annee"  value="${esc(v.annee||"")}" placeholder="Année">
      <input type="text" id="mv_couleur" value="${esc(v.couleur||"")}" placeholder="Couleur">
      <input type="text" id="mv_vin"    value="${esc(v.vin||"")}"   placeholder="N° VIN (châssis)">
    </div>`,
    function(){
      const get = id => document.getElementById(id)?.value.trim()||"";
      if(!get("mv_immat")){ toast("Immatriculation obligatoire","error"); return false; }
      vehicules[index] = { ...v, marque:get("mv_marque"), modele:get("mv_modele"), immat:get("mv_immat").toUpperCase(), annee:get("mv_annee"), couleur:get("mv_couleur"), vin:get("mv_vin") };
      saveData(); renderVehicules(); toast("Véhicule modifié ✓");
    }
  );
}

function renderVehicules(){
  const table = document.getElementById("listeVehicules");
  if(!table) return;
  table.innerHTML = vehicules.map((v,i)=>`
    <tr>
      <td>${escHtml(v.marque)}</td>
      <td>${escHtml(v.modele)}</td>
      <td><b>${escHtml(v.immat)}</b></td>
      <td>
        <button onclick="modifierVehicule(${i})">✏ Modifier</button>
        <button class="delete-btn" onclick="supprimerVehicule(${i})">🗑 Supprimer</button>
      </td>
    </tr>
  `).join("");
}

/* =====================================
   HISTORIQUE VEHICULE
===================================== */

function historiqueVehicule(){
  const immat = document.getElementById("rechercheHistorique").value.toLowerCase();
  const zone  = document.getElementById("historiqueVehicule");
  if(!zone) return;

  if(!immat){ zone.innerHTML=""; return; }

  const resultats = dossiers.filter(d => d.immat && d.immat.toLowerCase().includes(immat));

  if(resultats.length === 0){
    zone.innerHTML = `<div class="card"><p style="color:var(--muted)">Aucun dossier trouvé pour cette immatriculation.</p></div>`;
    return;
  }

  zone.innerHTML = resultats.map(d=>`
    <div class="card">
      <h3>${escHtml(d.immat)}</h3>
      <p><b>Dossier :</b> ${escHtml(d.numero)}</p>
      <p><b>Client :</b> ${escHtml(d.client)}</p>
      <p><b>Assurance :</b> ${escHtml(d.assurance)}</p>
      <p><b>Vitrage :</b> ${escHtml(d.vitrage||"")}</p>
      <p><b>Date :</b> ${escHtml(d.dateCreation||"")}</p>
      <p><b>Statut :</b> <span class="badge badge-${getBadgeClass(d.statut)}">${escHtml(d.statut)}</span></p>
    </div>
  `).join("");
}

/* =====================================
   BADGES STATUT
===================================== */

function getBadgeClass(statut){
  if(statut==="Terminé" || statut==="Facturé") return "success";
  if(statut==="En cours") return "warning";
  return "danger";
}

/* =====================================
   SECURITE XSS
===================================== */

function escHtml(str){
  if(!str) return "";
  return String(str)
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;");
}

/* =====================================
   GESTION CLIENTS
===================================== */

function ajouterClient(){
  const nom      = document.getElementById("nomClient").value.trim();
  const prenom   = document.getElementById("prenomClient").value.trim();
  const telephone= document.getElementById("telephoneClient").value.trim();

  if(!nom){ toast("Veuillez saisir un nom", "error"); return; }

  clients.push({ nom, prenom, telephone });
  saveData();
  renderClients();
  majDashboard();

  document.getElementById("nomClient").value       = "";
  document.getElementById("prenomClient").value    = "";
  document.getElementById("telephoneClient").value = "";

  toast("Client ajouté ✓");
}

function supprimerClient(index){
  confirmerAction("Supprimer ce client ?", ()=>{ clients.splice(index,1); saveData(); renderClients(); majDashboard(); toast("Client supprimé"); });
}

function modifierClient(index){
  const c = clients[index];
  const esc = v => (v||"").replace(/"/g,"&quot;");
  ouvrirModal("✏️ Modifier le client", `
    <div class="form-grid">
      <input type="text" id="mc_nom"      value="${esc(c.nom)}"       placeholder="Nom">
      <input type="text" id="mc_prenom"   value="${esc(c.prenom)}"    placeholder="Prénom">
      <input type="text" id="mc_tel"      value="${esc(c.telephone)}" placeholder="Téléphone">
      <input type="email" id="mc_email"   value="${esc(c.email||"")}" placeholder="Email">
      <input type="text" id="mc_adresse"  value="${esc(c.adresse||"")}" placeholder="Adresse">
    </div>`,
    function(){
      const get = id => document.getElementById(id)?.value.trim()||"";
      if(!get("mc_nom")){ toast("Nom obligatoire","error"); return false; }
      clients[index] = { ...c, nom:get("mc_nom"), prenom:get("mc_prenom"), telephone:get("mc_tel"), email:get("mc_email"), adresse:get("mc_adresse") };
      saveData(); renderClients(); toast("Client modifié ✓");
    }
  );
}

function renderClients(liste = clients){
  const table = document.getElementById("listeClients");
  if(!table) return;
  table.innerHTML = liste.map((c)=>{
    const i = clients.indexOf(c);
    return `
    <tr>
      <td>${escHtml(c.nom)}</td>
      <td>${escHtml(c.prenom)}</td>
      <td>${escHtml(c.telephone)}</td>
      <td style="font-size:12px;color:var(--muted);">
        ${_compterDossiersClient(c.nom, c.prenom)}
      </td>
      <td>
        <button onclick="ficheClientComplet(${i})" style="background:#7c3aed;">📋 Fiche</button>
        <button onclick="modifierClient(${i})">✏ Modifier</button>
        <button class="delete-btn" onclick="supprimerClient(${i})">🗑 Supprimer</button>
      </td>
    </tr>`;
  }).join("");
}

function rechercherClient(){
  const input = document.getElementById("rechercheClient");
  const recherche = normaliserCleAssurance(input ? input.value : "");
  if(!recherche){ renderClients(); return; }
  const resultats = clients.filter(c => normaliserCleAssurance(`${c.nom||""} ${c.prenom||""} ${c.telephone||""}`).includes(recherche));
  renderClients(resultats);
}

/* =====================================
   FRANCHISE
===================================== */

function gestionFranchise(){
  const franchise = document.getElementById("franchiseDossier");
  const montant   = document.getElementById("montantFranchise");
  if(!franchise || !montant) return;
  montant.style.display = franchise.value==="Oui" ? "" : "none";
  if(franchise.value!=="Oui") montant.value = "";
}

/* =====================================
   ASSURANCES
===================================== */

function ajouterAssurance(){
  const nom         = document.getElementById("nomAssurance").value.trim();
  const adresse     = document.getElementById("adresseAssuranceFiche").value.trim();
  const telephone   = document.getElementById("telephoneAssuranceFiche").value.trim();
  const email       = document.getElementById("emailAssuranceFiche").value.trim();
  const courtier    = document.getElementById("courtierAssurance").value.trim();
  const franchise   = document.getElementById("franchiseAssuranceFiche").value.trim();
  const declaration = document.getElementById("declarationAssuranceFiche").value.trim();
  const documents   = document.getElementById("documentsAssuranceFiche").value.trim();
  const facturation = document.getElementById("facturationAssuranceFiche").value.trim();
  const relance     = document.getElementById("relanceAssuranceFiche").value.trim();

  if(!nom){ toast("Nom assurance obligatoire", "error"); return; }

  assurances.push({ nom, adresse, telephone, email, courtier, franchise, declaration, documents, facturation, relance });
  saveData();
  renderAssurances();
  chargerListeAssurances();

  ["nomAssurance","adresseAssuranceFiche","telephoneAssuranceFiche","emailAssuranceFiche","courtierAssurance",
   "franchiseAssuranceFiche","declarationAssuranceFiche","documentsAssuranceFiche","facturationAssuranceFiche","relanceAssuranceFiche"]
    .forEach(id => { const el=document.getElementById(id); if(el) el.value=""; });

  toast("Assurance ajoutée ✓");
}

function supprimerAssurance(index){
  confirmerAction("Supprimer cette assurance ?", ()=>{ assurances.splice(index,1); saveData(); renderAssurances(); chargerListeAssurances(); toast("Assurance supprimée"); });
}

function renderAssurances(){
  const zone = document.getElementById("listeAssurances");
  if(!zone) return;
  const toutes = getToutesAssurances();
  zone.innerHTML = toutes.map((a,i)=>{
    const estPerso = assurances.some(x => normaliserCleAssurance(x.nom) === normaliserCleAssurance(a.nom));
    return `
    <tr>
      <td><b>${escHtml(a.nom)}</b></td>
      <td>${escHtml(a.telephone||"—")}</td>
      <td>${escHtml(a.email||"—")}</td>
      <td>${escHtml(a.adresse||a.facturation||"—")}</td>
      <td>${escHtml(a.franchise||"—")}</td>
      <td>
        <button onclick="voirAssurance(${i})">👁 Voir</button>
        <button onclick="modifierAssurance(${i})" style="background:#2563eb;">✏️ Modifier</button>
        ${estPerso ? `<button onclick="supprimerAssurance(${assurances.findIndex(x=>normaliserCleAssurance(x.nom)===normaliserCleAssurance(a.nom))})" class="delete-btn">🗑</button>` : ""}
      </td>
    </tr>`;
  }).join("");
}

function modifierAssurance(index){
  const a = getToutesAssurances()[index];
  if(!a) return;
  const zone = document.getElementById("detailAssurance");
  if(!zone) return;
  const idxPerso = assurances.findIndex(x => normaliserCleAssurance(x.nom) === normaliserCleAssurance(a.nom));
  const idxDefaut = assurancesParDefaut.findIndex(x => normaliserCleAssurance(x.nom) === normaliserCleAssurance(a.nom));
  const esc = v => (v||"").replace(/"/g,"&quot;");
  zone.innerHTML = `
    <div class="card">
      <h2>✏️ Modifier — ${escHtml(a.nom)}</h2>
      <div class="form-grid">
        <input type="text" id="editNom" value="${esc(a.nom)}" placeholder="Nom assurance">
        <input type="text" id="editTelephone" value="${esc(a.telephone)}" placeholder="Téléphone">
        <input type="email" id="editEmail" value="${esc(a.email)}" placeholder="Email">
        <input type="text" id="editAdresse" value="${esc(a.adresse||a.facturation)}" placeholder="Adresse / facturation">
        <input type="text" id="editCourtier" value="${esc(a.courtier)}" placeholder="Agence / Courtier">
        <input type="text" id="editFranchise" value="${esc(a.franchise)}" placeholder="Franchise">
        <input type="text" id="editDeclaration" value="${esc(a.declaration)}" placeholder="Mode de déclaration">
        <input type="text" id="editDocuments" value="${esc(a.documents)}" placeholder="Documents à fournir">
        <input type="text" id="editRelance" value="${esc(a.relance)}" placeholder="Relance / suivi règlement">
      </div>
      <div style="margin-top:12px;display:flex;gap:10px;flex-wrap:wrap;">
        <button class="btn-success" onclick="sauvegarderModifAssurance(${idxPerso}, ${idxDefaut})">💾 Enregistrer</button>
        <button onclick="document.getElementById('detailAssurance').innerHTML=\'\' ">✖ Annuler</button>
      </div>
    </div>`;
  zone.scrollIntoView({behavior:"smooth", block:"start"});
}

function sauvegarderModifAssurance(idxPerso, idxDefaut){
  const get = id => document.getElementById(id)?.value.trim() || "";
  const maj = {
    nom:         get("editNom"),
    telephone:   get("editTelephone"),
    email:       get("editEmail"),
    adresse:     get("editAdresse"),
    facturation: get("editAdresse"),
    courtier:    get("editCourtier"),
    franchise:   get("editFranchise"),
    declaration: get("editDeclaration"),
    documents:   get("editDocuments"),
    relance:     get("editRelance"),
  };
  if(!maj.nom){ toast("Nom obligatoire", "error"); return; }
  if(idxPerso >= 0){
    assurances[idxPerso] = { ...assurances[idxPerso], ...maj };
    saveData();
  } else if(idxDefaut >= 0){
    assurances.push({ ...assurancesParDefaut[idxDefaut], ...maj });
    saveData();
  }
  renderAssurances();
  chargerListeAssurances();
  document.getElementById("detailAssurance").innerHTML = "";
  toast("Assurance mise à jour ✓");
}

function voirAssurance(index){
  const a = getToutesAssurances()[index];
  const zone = document.getElementById("detailAssurance");
  if(!zone || !a) return;
  zone.innerHTML = `
    <div class="card">
      <h2>🛡 ${escHtml(a.nom)}</h2>
      <p><b>Téléphone :</b> ${escHtml(a.telephone||"—")}</p>
      <p><b>Email :</b> ${escHtml(a.email||"—")}</p>
      <p><b>Adresse / facturation :</b> ${escHtml(a.adresse||a.facturation||"—")}</p>
      <p><b>Franchise :</b> ${escHtml(a.franchise||"—")}</p>
      <p><b>Déclaration :</b> ${escHtml(a.declaration||"—")}</p>
      <p><b>Documents à fournir :</b> ${escHtml(a.documents||"—")}</p>
      <p><b>Relance / suivi règlement :</b> ${escHtml(a.relance||"—")}</p>
    </div>`;
  zone.scrollIntoView({behavior:"smooth", block:"start"});
}

function chargerListeAssurances(){
  const select = document.getElementById("assuranceDossier");
  if(!select) return;
  const current = select.value;
  select.innerHTML = '<option value="">Choisir une assurance</option>';
  getToutesAssurances().forEach(a=>{
    const opt = document.createElement("option");
    opt.value = a.nom;
    opt.textContent = a.nom;
    select.appendChild(opt);
  });
  if(current) select.value = current;
}

function remplirInfosAssurance(){
  const nom = document.getElementById("assuranceDossier")?.value;
  const a = trouverAssurance(nom);
  if(!a) return;
  const set = (id, val) => { const el=document.getElementById(id); if(el) el.value = val||""; };
  set("adresseAssurance",    a.adresse || a.facturation || "");
  set("agenceAssurance",     a.courtier || "");
  set("telephoneAssurance",  a.telephone || "");
  set("emailAssurance",      a.email || "");

  const franchise = document.getElementById("franchiseDossier");
  const montant   = document.getElementById("montantFranchise");
  if(franchise && a.franchise){
    franchise.value = "Oui";
    if(montant){ montant.style.display = ""; montant.value = a.franchise; }
  }
}

function ficheAssuranceHtml(nom){
  const a = trouverAssurance(nom);
  if(!a) return "";
  return `<h3>🛡 Fiche assurance</h3>
    <p><b>Téléphone :</b> ${escHtml(a.telephone||"—")}</p>
    <p><b>Email :</b> ${escHtml(a.email||"—")}</p>
    <p><b>Adresse / facturation :</b> ${escHtml(a.adresse||a.facturation||"—")}</p>
    <p><b>Franchise :</b> ${escHtml(a.franchise||"—")}</p>
    <p><b>Déclaration :</b> ${escHtml(a.declaration||"—")}</p>
    <p><b>Documents :</b> ${escHtml(a.documents||"—")}</p>
    <p><b>Relance :</b> ${escHtml(a.relance||"—")}</p>`;
}

/* =====================================
   GESTION DOSSIERS
===================================== */

function ajouterDossier(){
  const numero = getProchainNumeroDossier();

  const g = id => { const el=document.getElementById(id); return el ? el.value : ""; };

  const client         = g("clientDossier").trim();
  const adresse        = g("adresseDossier").trim();
  const vehicule       = g("vehiculeDossier");
  const modele         = g("modeleDossier").trim();
  const immat          = g("immatDossier").trim();
  const sinistre       = g("sinistreDossier").trim();
  const vitrage        = g("vitrageDossier");
  const typeDommage    = g("typeDommage");
  const devis          = g("devisDossier");
  const telephone      = g("telephoneDossier");
  const contrat        = g("contratDossier");
  const kilometrage    = g("kilometrageDossier");
  const lieuSinistre   = g("lieuSinistre");
  const dateSinistre   = g("dateSinistre");
  const franchise      = g("franchiseDossier");
  const montantFranchise = g("montantFranchise");
  const signatureClient  = g("signatureClient");
  const facture        = g("factureDossier");
  const assurance      = g("assuranceDossier");
  const adresseAssurance   = g("adresseAssurance");
  const agenceAssurance    = g("agenceAssurance");
  const telephoneAssurance = g("telephoneAssurance");
  const emailAssurance     = g("emailAssurance");
  const statut         = g("statutDossier");
  const observation    = g("observationDossier").trim();
  const dateReparation = g("dateReparation");
  const technicien     = g("technicien");

  if(!client){ toast("Client obligatoire", "error"); return; }

  const montantRembourse    = g("montantRembourse");
  const statutPriseEnCharge = g("statutPriseEnCharge");

  const emailClient = g("emailClient");

  let dossier = {
    numero, client, adresse, vehicule, modele, immat, sinistre,
    telephone, emailClient, contrat, kilometrage, dateSinistre, lieuSinistre,
    franchise, montantFranchise, adresseAssurance, agenceAssurance,
    telephoneAssurance, emailAssurance, signatureClient,
    vitrage, typeDommage, devis, facture, assurance, statut, observation,
    dateReparation, technicien,
    montantRembourse, statutPriseEnCharge,
    dateCreation: new Date().toLocaleDateString("fr-FR"),
    photo:"", fichierDevis:"", fichierFacture:""
  };

  const photoInput   = document.getElementById("photoDossier");
  const devisFile    = document.getElementById("fichierDevis");
  const factureFile  = document.getElementById("fichierFacture");

  // On utilise URL.createObjectURL pour les PDF (session uniquement — ils ne survivent pas au rechargement)
  if(devisFile && devisFile.files && devisFile.files.length > 0){
    dossier.fichierDevis = URL.createObjectURL(devisFile.files[0]);
  }
  if(factureFile && factureFile.files && factureFile.files.length > 0){
    dossier.fichierFacture = URL.createObjectURL(factureFile.files[0]);
  }

  const finalize = () => {
    dossiers.push(dossier);
    ajouterClientDepuisDossier(dossier);
    saveData();
    renderClients();
    renderDossiers();
    renderDossiersRecent();
    chargerDossiersSelect();
    majDashboard();
    toast("Dossier créé ✓ — N° " + numero);
    resetFormDossier();
  };

  if(photoInput && photoInput.files && photoInput.files.length){
    const reader = new FileReader();
    reader.onload = () => { dossier.photo = reader.result; finalize(); };
    reader.readAsDataURL(photoInput.files[0]);
  } else {
    finalize();
  }
}

function resetFormDossier(){
  const ids = ["clientDossier","vehiculeDossier","modeleDossier","immatDossier",
    "sinistreDossier","devisDossier","factureDossier","observationDossier",
    "telephoneDossier","adresseDossier","contratDossier","kilometrageDossier",
    "dateSinistre","lieuSinistre","signatureClient","technicien","dateReparation",
    "typeDommage","adresseAssurance","agenceAssurance","telephoneAssurance","emailAssurance",
    "montantRembourse","statutPriseEnCharge","emailClient"];
  ids.forEach(id=>{
    const el = document.getElementById(id);
    if(el) el.value = "";
  });
}

function supprimerDossier(index){
  confirmerAction("Supprimer définitivement ce dossier ?", ()=>{
    dossiers.splice(index, 1);
    saveData();
    renderDossiers();
    renderDossiersRecent();
    chargerDossiersSelect();
    majDashboard();
    toast("Dossier supprimé");
  });
}

function changerStatutDossier(index, statut){
  if(!dossiers[index]) return;
  dossiers[index].statut = statut;
  saveData();
  renderDossiersRecent();
  majDashboard();
  toast("Statut mis à jour : " + statut);
}

function modifierDossier(index){
  const d = dossiers[index];
  const esc = x => (x||"").replace(/"/g,"&quot;");
  const assOpts = getToutesAssurances().map(a =>
    `<option value="${esc(a.nom)}" ${d.assurance===a.nom?"selected":""}>${escHtml(a.nom)}</option>`
  ).join("");
  ouvrirModal("✏️ Modifier le dossier N°" + d.numero, `
    <div class="form-grid">
      <input type="text" id="md_numero"    value="${esc(d.numero)}"          placeholder="N° dossier">
      <input type="text" id="md_client"    value="${esc(d.client)}"          placeholder="Client">
      <input type="text" id="md_vehicule"  value="${esc(d.vehicule)}"        placeholder="Véhicule (marque modèle)">
      <input type="text" id="md_immat"     value="${esc(d.immat||"")}"       placeholder="Immatriculation">
      <input type="text" id="md_telephone" value="${esc(d.telephone||"")}"   placeholder="Téléphone">
      <input type="text" id="md_adresse"   value="${esc(d.adresse||"")}"     placeholder="Adresse client">
      <input type="text" id="md_sinistre"  value="${esc(d.sinistre||"")}"    placeholder="N° Sinistre">
      <input type="text" id="md_contrat"   value="${esc(d.contrat||"")}"     placeholder="N° Contrat">
      <input type="date" id="md_dateSin"   value="${esc(d.dateSinistre||"")}"                              title="Date du sinistre">
      <input type="text" id="md_lieuSin"   value="${esc(d.lieuSinistre||"")}"  placeholder="Lieu du sinistre">
      <select id="md_assurance"><option value="">-- Assurance --</option>${assOpts}</select>
      <select id="md_franchise" onchange="document.getElementById('md_montantFranchise').style.display=this.value==='Oui'?'':'none'">
        <option value="Non" ${(d.franchise||"Non")==="Non"?"selected":""}>Franchise : Non</option>
        <option value="Oui" ${d.franchise==="Oui"?"selected":""}>Franchise : Oui</option>
      </select>
      <input type="number" id="md_montantFranchise" value="${esc(d.montantFranchise||"")}" placeholder="Montant franchise (€)" style="display:${d.franchise==="Oui"?"":"none"}">
      <select id="md_statut">
        <option value="En attente" ${d.statut==="En attente"?"selected":""}>⏳ En attente</option>
        <option value="En cours"   ${d.statut==="En cours"  ?"selected":""}>🔧 En cours</option>
        <option value="Terminé"    ${d.statut==="Terminé"   ?"selected":""}>✅ Terminé</option>
        <option value="Facturé"    ${d.statut==="Facturé"   ?"selected":""}>🧾 Facturé</option>
      </select>
      <input type="text" id="md_kilometrage"  value="${esc(d.kilometrage||"")}"  placeholder="Kilométrage">
      <input type="text" id="md_technicien"   value="${esc(d.technicien||"")}"   placeholder="Technicien">
      <textarea id="md_observation" placeholder="Observations / Notes" style="grid-column:1/-1;height:70px;">${esc(d.observation||"")}</textarea>
    </div>`,
    function(){
      const get = id => document.getElementById(id)?.value.trim()||"";
      dossiers[index] = { ...d,
        numero:          get("md_numero"),
        client:          get("md_client"),
        vehicule:        get("md_vehicule"),
        immat:           get("md_immat").toUpperCase(),
        telephone:       get("md_telephone"),
        adresse:         get("md_adresse"),
        sinistre:        get("md_sinistre"),
        contrat:         get("md_contrat"),
        dateSinistre:    get("md_dateSin"),
        lieuSinistre:    get("md_lieuSin"),
        assurance:       get("md_assurance"),
        franchise:       get("md_franchise"),
        montantFranchise:get("md_montantFranchise"),
        statut:          get("md_statut"),
        kilometrage:     get("md_kilometrage"),
        technicien:      get("md_technicien"),
        observation:     get("md_observation"),
        modifiedAt: new Date().toISOString(),
        modifiedBy: getSessionUtilisateur()?.nom || "—"
      };
      saveData(); renderDossiers(); renderDossiersRecent(); majDashboard();
      toast("Dossier modifié ✓");
    }
  );
}


function dupliquerDossier(index){
  const d = dossiers[index];
  if(!d) return;
  const nouveau = {
    ...d,
    numero: getProchainNumeroDossier(),
    statut: "En attente",
    devis: "", facture: "",
    dateCreation: new Date().toISOString().split("T")[0],
    createdAt: new Date().toISOString(),
    modifiedAt: null,
    modifiedBy: null
  };
  dossiers.push(nouveau);
  saveData();
  renderDossiers();
  renderDossiersRecent();
  majDashboard();
  toast("Dossier dupliqué → N°" + nouveau.numero + " ✓");
}

/* =====================================
   RECHERCHE DOSSIERS
===================================== */

function rechercherDossier(){
  const recherche  = (document.getElementById("rechercheDossier")?.value || "").toLowerCase();
  const immat      = (document.getElementById("rechercheImmat")?.value   || "").toLowerCase();
  const dateDebut  = document.getElementById("filtreDateDebut")?.value  || "";
  const dateFin    = document.getElementById("filtreDateFin")?.value    || "";
  const filtreStatut = document.getElementById("filtreStatutDossier")?.value || "";

  document.querySelectorAll("#listeDossiers tr").forEach((ligne,i)=>{
    const texte = ligne.textContent.toLowerCase();
    let ok = texte.includes(recherche) && texte.includes(immat);

    if(ok && filtreStatut){
      const d = dossiers[i];
      if(d && d.statut !== filtreStatut) ok = false;
    }

    if(ok && (dateDebut || dateFin) && dossiers[i]){
      const dateD = dossiers[i].dateCreation || dossiers[i].date || "";
      if(dateDebut && dateD && dateD < dateDebut) ok = false;
      if(dateFin   && dateD && dateD > dateFin)   ok = false;
    }

    ligne.style.display = ok ? "" : "none";
  });
}

/* =====================================
   RENDER DOSSIERS
===================================== */

function renderDossiers(){
  const table = document.getElementById("listeDossiers");
  if(!table) return;

  table.innerHTML = dossiers.map((d,i)=>`
    <tr>
      <td><b>${escHtml(d.numero)}</b></td>
      <td>${escHtml(d.client)}</td>
      <td>${escHtml(d.vehicule)}</td>
      <td>${escHtml(d.immat||"")}</td>
      <td>${escHtml(d.sinistre||"")}</td>
      <td>${escHtml(d.assurance)}</td>
      <td>
        <select onchange="changerStatutDossier(${i}, this.value)" style="padding:4px 8px;border-radius:6px;background:#1e293b;color:#f1f5f9;border:1px solid #334155;font-size:13px;">
          <option value="En attente" ${d.statut==="En attente"?"selected":""}>⏳ En attente</option>
          <option value="En cours"   ${d.statut==="En cours"  ?"selected":""}>🔧 En cours</option>
          <option value="Terminé"    ${d.statut==="Terminé"   ?"selected":""}>✅ Terminé</option>
          <option value="Facturé"    ${d.statut==="Facturé"   ?"selected":""}>🧾 Facturé</option>
        </select>
      </td>
      <td>${d.photo ? `<img src="${d.photo}" width="70" style="border-radius:6px;">` : "—"}</td>
      <td>${d.fichierDevis   ? `<a href="${d.fichierDevis}"   target="_blank" class="btn-pdf">📄 Voir</a>` : "—"}</td>
      <td>${d.fichierFacture ? `<a href="${d.fichierFacture}" target="_blank" class="btn-pdf">🧾 Voir</a>` : "—"}</td>
      <td style="white-space:nowrap">
        <button onclick="ouvrirDossier(${i})">👁 Ouvrir</button>
        <button onclick="modifierDossier(${i})">✏ Modifier</button>
        <button onclick="dupliquerDossier(${i})" style="background:#0891b2;padding:5px 8px;font-size:12px;">📋 Dupliquer</button>
        <button onclick="genererDeclaration(${i})">📋 Déclaration</button>
        <button onclick="genererCessionCreances(${i})" style="background:#7c3aed;">💼 Cession</button>
        <button onclick="emailAssurance(${i})">📧 Email</button>
        <button class="delete-btn" onclick="supprimerDossier(${i})">🗑</button>
      </td>
    </tr>
  `).join("");
}

function renderDossiersRecent(){
  const table = document.getElementById("listeDossiersRecent");
  if(!table) return;
  const vitrages = dossiers.map(d => ({...d, _typeDashboard:"vitrage", _indexDashboard:dossiers.indexOf(d)}));
  const mecas = (typeof dossiersMecanique !== "undefined" ? dossiersMecanique : []).map(d => ({...d, _typeDashboard:"mecanique", _indexDashboard:dossiersMecanique.indexOf(d)}));
  const recents = [...vitrages, ...mecas].sort((a,b)=> new Date(b.createdAt||0) - new Date(a.createdAt||0)).slice(0, 8);
  table.innerHTML = recents.map(d=>`
    <tr>
      <td><b>${escHtml(d.numero)}</b><br><small style="color:var(--muted);">${d._typeDashboard==="mecanique"?"🔩 Mécanique":"🪟 Vitrage"}</small></td>
      <td>${escHtml(d.client)}</td>
      <td>${escHtml(d.vehicule||d.immat||"—")}</td>
      <td>${d._typeDashboard==="mecanique" ? escHtml(d.typePanne||"Mécanique") : escHtml(d.assurance||"—")}</td>
      <td>
        <select onchange="${d._typeDashboard==="mecanique"?"changerStatutMecanique":"changerStatutDossier"}(${d._indexDashboard}, this.value)" style="padding:4px 8px;border-radius:6px;background:#1e293b;color:#f1f5f9;border:1px solid #334155;font-size:13px;">
          <option value="En attente" ${d.statut==="En attente"?"selected":""}>⏳ En attente</option>
          <option value="En cours"   ${d.statut==="En cours"  ?"selected":""}>🔧 En cours</option>
          <option value="En attente pièces" ${d.statut==="En attente pièces"?"selected":""}>📦 Attente pièces</option>
          <option value="Terminé"    ${d.statut==="Terminé"   ?"selected":""}>✅ Terminé</option>
          <option value="Facturé"    ${d.statut==="Facturé"   ?"selected":""}>🧾 Facturé</option>
        </select>
      </td>
    </tr>
  `).join("");
}

/* =====================================
   FICHE DOSSIER
===================================== */

function ouvrirDossier(index){
  const d = dossiers[index];
  const zone = document.getElementById("detailDossier");
  if(!zone) return;

  zone.innerHTML = `
    <div class="card">
      <h2>📁 Dossier ${escHtml(d.numero)}</h2>

      <h3>👤 Client</h3>
      <p><b>${escHtml(d.client)}</b></p>
      <p>${escHtml(d.adresse||"")} ${escHtml(d.telephone||"")}</p>

      <h3>🚗 Véhicule</h3>
      <p>${escHtml(d.vehicule)} ${escHtml(d.modele||"")}</p>
      <p><b>Immatriculation :</b> ${escHtml(d.immat||"")}</p>
      <p><b>Kilométrage :</b> ${escHtml(d.kilometrage||"—")}</p>

      <h3>🔧 Vitrage endommagé</h3>
      <p>${escHtml(d.vitrage||"—")}</p>
      ${d.typeDommage ? `<p><b>Type de dommage :</b> <span class="badge badge-warning" style="font-size:12px;">${escHtml(d.typeDommage)}</span></p>` : ""}

      <h3>🛡 Assurance</h3>
      <p>${escHtml(d.assurance)}</p>
      <p><b>N° Contrat :</b> ${escHtml(d.contrat||"—")}</p>
      <p><b>N° Sinistre :</b> ${escHtml(d.sinistre||"—")}</p>
      <p><b>Franchise :</b> ${d.franchise==="Oui" ? "Oui — " + (d.montantFranchise && d.montantFranchise!=="0" ? d.montantFranchise : "à confirmer") + " €" : "Non — 0 €"}</p>

      <h3>📅 Dates</h3>
      <p><b>Date sinistre :</b> ${escHtml(d.dateSinistre||"—")}</p>
      <p><b>Lieu sinistre :</b> ${escHtml(d.lieuSinistre||"—")}</p>
      <p><b>Date création :</b> ${escHtml(d.dateCreation||"")}</p>
      <p><b>Date réparation :</b> ${escHtml(d.dateReparation||"—")}</p>

      <h3>📝 Observations</h3>
      <p>${escHtml(d.observation||"Aucune observation")}</p>

      <h3>💰 Financier</h3>
      <p><b>Montant devis :</b> ${escHtml(String(d.devis||0))} €</p>
      <p><b>Montant facture :</b> ${escHtml(String(d.facture||0))} €</p>

      <h3>📌 Statut</h3>
      <p><span class="badge badge-${getBadgeClass(d.statut)}">${escHtml(d.statut)}</span></p>

      ${ficheAssuranceHtml(d.assurance)}

      <h3>📄 Documents</h3>
      ${d.fichierDevis   ? `<p><a href="${d.fichierDevis}" target="_blank" class="btn-pdf">📄 Ouvrir le devis</a></p>` : "<p>Aucun devis joint</p>"}
      ${d.fichierFacture ? `<p><a href="${d.fichierFacture}" target="_blank" class="btn-pdf">🧾 Ouvrir la facture</a></p>` : "<p>Aucune facture jointe</p>"}

      ${d.photo ? `<h3>📸 Photo véhicule</h3><img src="${d.photo}" style="max-width:600px;width:100%;border-radius:12px;margin-top:10px;">` : ""}

      ${d.modifiedAt ? `<div style="margin-top:12px;padding:10px;background:#0f172a;border-radius:8px;font-size:12px;color:#64748b;border:1px solid #1e293b;">
        ✏️ Dernière modification : <b>${new Date(d.modifiedAt).toLocaleDateString("fr-FR")} à ${new Date(d.modifiedAt).toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"})}</b>
        ${d.modifiedBy ? " — par <b>" + escHtml(d.modifiedBy) + "</b>" : ""}
      </div>` : ""}
      <br>
      <button onclick="imprimerDossier()">🖨 Imprimer</button>
      <button onclick="genererDeclaration(${index})">📋 Déclaration</button>
      <button onclick="emailAssurance(${index})">📧 Email assurance</button>
      <button onclick="afficherTransfertDossier(${index})" style="background:#7c3aed;">🔀 Transférer</button>
      <button onclick="showPage('dossiers')">⬅ Retour</button>

      <div id="panneauTransfert" style="display:none;margin-top:20px;padding:20px;background:#0f172a;border:1px solid #7c3aed44;border-radius:12px;">
        <h3 style="color:#a78bfa;">🔀 Transférer vers un autre dossier</h3>
        <p style="color:#94a3b8;font-size:13px;">Choisissez le dossier de destination. Les informations sélectionnées seront copiées vers ce dossier.</p>
        <div class="form-grid" style="margin-top:12px;">
          <select id="dossierDestination" style="font-size:13px;">
            <option value="">-- Choisir le dossier destination --</option>
          </select>
        </div>
        <div style="margin-top:12px;">
          <p style="font-size:12px;color:#94a3b8;margin-bottom:8px;">Choisir ce qui sera transféré :</p>
          <label style="display:flex;align-items:center;gap:8px;margin-bottom:6px;cursor:pointer;"><input type="checkbox" id="trfClient" checked> Client &amp; véhicule</label>
          <label style="display:flex;align-items:center;gap:8px;margin-bottom:6px;cursor:pointer;"><input type="checkbox" id="trfAssurance" checked> Assurance &amp; sinistre</label>
          <label style="display:flex;align-items:center;gap:8px;margin-bottom:6px;cursor:pointer;"><input type="checkbox" id="trfFinancier"> Montants (devis / facture)</label>
          <label style="display:flex;align-items:center;gap:8px;margin-bottom:6px;cursor:pointer;"><input type="checkbox" id="trfObservation"> Observations</label>
        </div>
        <div style="margin-top:14px;display:flex;gap:10px;">
          <button onclick="executerTransfert(${index})" style="background:#7c3aed;">✅ Confirmer le transfert</button>
          <button onclick="document.getElementById('panneauTransfert').style.display='none'">✖ Annuler</button>
        </div>
      </div>
    </div>
  `;

  showPage("ficheDossier");
}

function afficherTransfertDossier(indexSource){
  const panneau = document.getElementById("panneauTransfert");
  if(!panneau) return;
  panneau.style.display = panneau.style.display === "none" ? "" : "none";
  const select = document.getElementById("dossierDestination");
  if(!select) return;
  select.innerHTML = '<option value="">-- Choisir le dossier destination --</option>';
  dossiers.forEach((d, i) => {
    if(i === indexSource) return;
    const opt = document.createElement("option");
    opt.value = i;
    opt.textContent = `N°${d.numero} — ${d.client} — ${d.vehicule} (${d.immat||"—"})`;
    select.appendChild(opt);
  });
}

function executerTransfert(indexSource){
  const select = document.getElementById("dossierDestination");
  const indexDest = select?.value;
  if(indexDest === "" || indexDest === null){ toast("Choisissez un dossier destination", "error"); return; }
  const src  = dossiers[indexSource];
  const dest = dossiers[Number(indexDest)];
  if(!src || !dest){ toast("Dossier introuvable", "error"); return; }

  confirmerAction(`Transférer les informations du dossier ${src.numero} vers ${dest.numero} ?`, ()=>{
  if(document.getElementById("trfClient")?.checked){
    dest.client    = src.client;
    dest.vehicule  = src.vehicule;
    dest.modele    = src.modele;
    dest.immat     = src.immat;
    dest.telephone = src.telephone;
    dest.adresse   = src.adresse;
    dest.kilometrage = src.kilometrage;
  }
  if(document.getElementById("trfAssurance")?.checked){
    dest.assurance      = src.assurance;
    dest.sinistre       = src.sinistre;
    dest.contrat        = src.contrat;
    dest.franchise      = src.franchise;
    dest.montantFranchise = src.montantFranchise;
    dest.dateSinistre   = src.dateSinistre;
    dest.lieuSinistre   = src.lieuSinistre;
    dest.vitrage        = src.vitrage;
    dest.typeDommage    = src.typeDommage;
  }
  if(document.getElementById("trfFinancier")?.checked){
    dest.devis   = src.devis;
    dest.facture = src.facture;
  }
  if(document.getElementById("trfObservation")?.checked){
    dest.observation = src.observation;
  }

  saveData();
  renderDossiers();
  renderDossiersRecent();
  majDashboard();
  document.getElementById("panneauTransfert").style.display = "none";
  toast("Transfert effectué vers le dossier " + dest.numero + " ✓");
  }); // fin confirmerAction
}

/* =====================================
   IMPRESSION DOSSIER
===================================== */

function imprimerDossier(){
  const contenu = document.getElementById("detailDossier").innerHTML;
  const fenetre = window.open("", "", "width=1000,height=800");
  fenetre.document.write(`<html><head><title>Impression dossier</title>
    <style>body{font-family:Arial;padding:30px;}img{max-width:500px;}.badge{padding:3px 8px;border-radius:10px;font-weight:bold;}</style>
    </head><body>${contenu}</body></html>`);
  fenetre.document.close();
  fenetre.print();
}

/* =====================================
   PDF DEVIS
===================================== */

function pdfDevis(index){
  if(!window.jspdf){ toast("Bibliothèque PDF non chargée", "error"); return; }
  const d = dossiers[index];
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  if(entreprise.logo){
    try{ doc.addImage(entreprise.logo,"JPEG",15,10,35,20); }catch(e){}
  }

  doc.setFontSize(20);
  doc.text("DEVIS", 105, 20, {align:"center"});

  doc.setFontSize(10);
  doc.text(entreprise.nom||"",     150, 15);
  doc.text(entreprise.adresse||"", 150, 20);
  doc.text(entreprise.telephone||"",150, 25);
  doc.text(entreprise.email||"",   150, 30);
  doc.text("SIRET : "+(entreprise.siret||""), 150, 35);

  doc.setFontSize(12);
  doc.text("N° Dossier : "+d.numero,         20, 50);
  doc.text("Client : "+d.client,             20, 58);
  doc.text("Véhicule : "+d.vehicule,         20, 66);
  doc.text("Immatriculation : "+(d.immat||""),20, 74);
  doc.text("Assurance : "+d.assurance,       20, 82);
  doc.text("N° Sinistre : "+(d.sinistre||""),20, 90);
  doc.text("Vitrage : "+(d.vitrage||""),     20, 98);

  doc.setFontSize(16);
  doc.text("Montant devis : "+(d.devis||0)+" €", 20, 116);

  doc.setFontSize(10);
  doc.text("Date : "+new Date().toLocaleDateString("fr-FR"), 20, 130);
  doc.text("Technicien : "+(d.technicien||""), 20, 138);

  doc.save("Devis_"+d.numero+".pdf");
}

/* =====================================
   PDF FACTURE
===================================== */

function pdfFacture(index){
  if(!window.jspdf){ toast("Bibliothèque PDF non chargée", "error"); return; }
  const d = dossiers[index];
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  if(entreprise.logo){
    try{ doc.addImage(entreprise.logo,"JPEG",15,10,35,20); }catch(e){}
  }

  doc.setFontSize(20);
  doc.text("FACTURE", 105, 20, {align:"center"});

  doc.setFontSize(10);
  doc.text(entreprise.nom||"",     150, 15);
  doc.text(entreprise.adresse||"", 150, 20);
  doc.text(entreprise.telephone||"",150, 25);
  doc.text(entreprise.email||"",   150, 30);
  doc.text("SIRET : "+(entreprise.siret||""), 150, 35);

  doc.setFontSize(12);
  doc.text("N° Dossier : "+d.numero,         20, 50);
  doc.text("Client : "+d.client,             20, 58);
  doc.text("Véhicule : "+d.vehicule,         20, 66);
  doc.text("Immatriculation : "+(d.immat||""),20, 74);
  doc.text("Assurance : "+d.assurance,       20, 82);
  doc.text("N° Sinistre : "+(d.sinistre||""),20, 90);
  doc.text("N° Contrat : "+(d.contrat||""),  20, 98);
  doc.text("Vitrage : "+(d.vitrage||""),     20, 106);

  doc.setFontSize(16);
  doc.text("Montant facture : "+(d.facture||0)+" €", 20, 124);

  doc.setFontSize(10);
  doc.text("Date : "+new Date().toLocaleDateString("fr-FR"), 20, 138);
  doc.text("Technicien : "+(d.technicien||""), 20, 146);

  doc.save("Facture_"+d.numero+".pdf");
}

/* =====================================
   DECLARATION BRIS DE GLACE
===================================== */

function genererDeclaration(index){
  const d = dossiers[index];
  const fenetre = window.open("", "_blank");

  const checkVitrage = nom => d.vitrage===nom ? "☑" : "☐";

  fenetre.document.write(`
<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Déclaration Bris de Glace</title>
<style>
body{font-family:Arial;padding:24px;font-size:14px;}
h1{text-align:center;margin-bottom:24px;}
table{width:100%;border-collapse:collapse;}
td{border:1px solid #333;padding:10px;vertical-align:top;}
h3{margin:10px 0 6px;}
</style>
</head>
<body>
<h1>Déclaration de Sinistre Bris de Glace</h1>
<table>
<tr>
  <td colspan="2">
    <h3>Assuré</h3>
    <b>Nom et prénom :</b> ${escHtml(d.client)}<br>
    <b>Adresse :</b> ${escHtml(d.adresse||"")}<br>
    <b>Téléphone :</b> ${escHtml(d.telephone||"")}
  </td>
</tr>
<tr>
  <td width="50%">
    <h3>Assureur</h3>
    <b>Assureur :</b> ${escHtml(d.assurance)}<br>
    <b>Adresse :</b> ${escHtml(d.adresseAssurance||"")}<br>
    <b>Agence / Courtier :</b> ${escHtml(d.agenceAssurance||"")}<br>
    <b>Téléphone :</b> ${escHtml(d.telephoneAssurance||"")}<br>
    <b>Email :</b> ${escHtml(d.emailAssurance||"")}<br>
    <b>N° Contrat :</b> ${escHtml(d.contrat||"")}
  </td>
  <td>
    <h3>Véhicule</h3>
    <b>Immatriculation :</b> ${escHtml(d.immat||"")}<br>
    <b>Marque :</b> ${escHtml(d.vehicule||"")}<br>
    <b>Kilométrage :</b> ${escHtml(d.kilometrage||"")}
  </td>
</tr>
<tr>
  <td colspan="2">
    <h3>Sinistre</h3>
    <b>N° Dossier :</b> ${escHtml(d.numero)}<br>
    <b>Date :</b> ${escHtml(d.dateSinistre||"")} &nbsp; <b>Lieu :</b> ${escHtml(d.lieuSinistre||"")}<br>
    <b>N° Sinistre :</b> ${escHtml(d.sinistre||"")}
  </td>
</tr>
<tr>
  <td colspan="2">
    <h3>Vitrage concerné</h3>
    ${checkVitrage("Pare-brise")} Pare-brise &nbsp;
    ${checkVitrage("Lunette arrière")} Lunette arrière &nbsp;
    ${checkVitrage("Vitre avant gauche")} Vitre av. gauche &nbsp;
    ${checkVitrage("Vitre avant droite")} Vitre av. droite &nbsp;
    ${checkVitrage("Toit panoramique")} Toit panoramique &nbsp;
    ${checkVitrage("Autre")} Autre
  </td>
</tr>
<tr>
  <td colspan="2">
    <b>Type de dommage :</b>
    &nbsp;
    ${["Impact (≤ 30 cm)","Impact (+ 30 cm)","Fissure","Éclat / Rayure","Bris total"].map(t =>
      `<span style="margin-right:12px;">${d.typeDommage===t||d.typeDommage===t.replace("≤ 30 cm","")?"☑":"☐"} ${t}</span>`
    ).join("")}
  </td>
</tr>
<tr>
  <td colspan="2">
    <b>Franchise :</b> ${
      d.franchise==="Oui"
        ? "Oui — " + (d.montantFranchise && d.montantFranchise!=="0" ? d.montantFranchise : "à confirmer") + " €"
        : "Non — 0 €"
    }
  </td>
</tr>
<tr>
  <td colspan="2" style="height:80px;">
    <b>Nom et prénom de l'assuré :</b><br><br>
    ${escHtml(d.signatureClient||d.client||"")}
  </td>
</tr>
</table>

<div style="margin-top:30px;padding:14px 16px;border:1px solid #333;font-size:12px;line-height:1.7;">
  <p><i><b>Je certifie sur l'honneur que les déclarations ci-dessus sont sincères et véritables.</b></i></p>
  <p><i>Je suis avisé qu'en cas de fausses déclarations de ma part je serais déchu de tout droit à garantie et que je m'exposerais à des sanctions pénales (art 441-7 du Code Pénal sur l'établissement et l'usage d'attestations inexactes et art 313-1 du Code Pénal réprimant le délit d'escroquerie ).</i></p>
  <br>
  <p style="display:flex;justify-content:space-between;align-items:flex-end;margin-top:10px;">
    <span><b>Fait à</b>&nbsp;&nbsp;&nbsp; ______________________ &nbsp;&nbsp;&nbsp; <b>le</b> ${new Date().toLocaleDateString("fr-FR")}</span>
    <span><b>Signature de l'assuré</b></span>
  </p>
  <div style="height:60px;border-bottom:1px solid #333;margin-top:10px;"></div>
</div>

</body>
</html>`);

  fenetre.document.close();
  fenetre.print();
}

/* =====================================
   EMAIL ASSURANCE
===================================== */

function emailAssurance(index){
  const d = dossiers[index];
  const destinataire = d.emailAssurance || "";
  const sujet = "Demande de prise en charge bris de glace - " + d.immat;
  const message =
`Bonjour,

Veuillez trouver ci-dessous les informations pour une demande de prise en charge bris de glace.

Client : ${d.client}
Téléphone : ${d.telephone||""}
Adresse : ${d.adresse||""}

Véhicule : ${d.vehicule}
Immatriculation : ${d.immat}
Kilométrage : ${d.kilometrage||""}

Assurance : ${d.assurance}
N° contrat : ${d.contrat||""}
N° sinistre : ${d.sinistre||""}

Vitrage concerné : ${d.vitrage||""}
Date du sinistre : ${d.dateSinistre||""}
Lieu du sinistre : ${d.lieuSinistre||""}

Observations :
${d.observation||""}

Cordialement,
${entreprise.nom||"DA-Gestion"}`;

  // Ouvrir Gmail directement avec le mail pré-rempli
  const gmailUrl = "https://mail.google.com/mail/?view=cm&fs=1"
    + "&to="      + encodeURIComponent(destinataire)
    + "&su="      + encodeURIComponent(sujet)
    + "&body="    + encodeURIComponent(message);

  window.open(gmailUrl, "_blank");
}

/* =====================================
   ENTREPRISE
===================================== */

function sauvegarderEntreprise(){
  const g = id => { const el=document.getElementById(id); return el ? el.value.trim() : ""; };
  entreprise.nom       = g("societeNom");
  entreprise.adresse   = g("societeAdresse");
  entreprise.telephone = g("societeTelephone");
  entreprise.email     = g("societeEmail");
  entreprise.siret     = g("societeSiret");

  const logoInput = document.getElementById("societeLogo");
  if(logoInput && logoInput.files && logoInput.files.length > 0){
    const reader = new FileReader();
    reader.onload = e => {
      entreprise.logo = e.target.result;
      saveData();
      afficherEntreprise();
      toast("Informations entreprise enregistrées ✓");
    };
    reader.readAsDataURL(logoInput.files[0]);
  } else {
    saveData();
    afficherEntreprise();
    toast("Informations entreprise enregistrées ✓");
  }
}

function chargerEntreprise(){
  const set = (id, val) => { const el=document.getElementById(id); if(el) el.value=val; };
  set("societeNom",       entreprise.nom||"");
  set("societeAdresse",   entreprise.adresse||"");
  set("societeTelephone", entreprise.telephone||"");
  set("societeEmail",     entreprise.email||"");
  set("societeSiret",     entreprise.siret||"");
  afficherEntreprise();
}

function afficherEntreprise(){
  const zone = document.getElementById("apercuEntreprise");
  if(!zone) return;
  zone.innerHTML = entreprise.logo
    ? `<img src="${entreprise.logo}" style="max-width:200px;margin-top:16px;border-radius:10px;">`
    : "";
}

function viderEntreprise(){
  confirmerAction("Supprimer les informations société ?", ()=>{
    entreprise = { nom:"", adresse:"", telephone:"", email:"", siret:"", logo:"" };
    saveData();
    chargerEntreprise();
    toast("Informations réinitialisées");
  });
}

/* =====================================
   EXPORT / IMPORT
===================================== */

function exporterDonnees(){
  const data = { clients, vehicules, dossiers, rendezVous, assurances, entreprise };
  const blob = new Blob([JSON.stringify(data, null, 2)], {type:"application/json"});
  const lien = document.createElement("a");
  lien.href = URL.createObjectURL(blob);
  lien.download = "Opr_Sauvegarde_"+new Date().toISOString().split("T")[0]+".json";
  lien.click();
  toast("Export réussi ✓");
}

function importerDonnees(event){
  const file = event.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try{
      const data = JSON.parse(e.target.result);
      if(data.clients)    clients    = data.clients;
      if(data.vehicules)  vehicules  = data.vehicules;
      if(data.dossiers)   dossiers   = data.dossiers;
      if(data.rendezVous) rendezVous = data.rendezVous;
      if(data.assurances) assurances = data.assurances;
      if(data.entreprise) entreprise = data.entreprise;
      saveData();
      initialiserApplication();
      toast("Import réussi — données chargées ✓");
    } catch(err){
      toast("Fichier invalide", "error");
    }
  };
  reader.readAsText(file);
}


function renderCalendrierRdv(){
  const zone = document.getElementById("calendrierRdv");
  if(!zone) return;

  // Mois affiché (stocké dans dataset)
  let annee = parseInt(zone.dataset.annee || new Date().getFullYear());
  let mois  = parseInt(zone.dataset.mois  || new Date().getMonth());

  const premierJour = new Date(annee, mois, 1).getDay(); // 0=dim
  const nbJours     = new Date(annee, mois+1, 0).getDate();
  const aujour      = new Date().toISOString().split("T")[0];

  const nomsMois = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
  const joursDebut = premierJour === 0 ? 6 : premierJour - 1; // lundi=0

  let html = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
      <button onclick="naviguerCalendrier(-1)" style="padding:6px 12px;">◀</button>
      <h3 style="color:#38bdf8;">${nomsMois[mois]} ${annee}</h3>
      <button onclick="naviguerCalendrier(1)" style="padding:6px 12px;">▶</button>
    </div>
    <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;text-align:center;">
      ${["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"].map(j=>`<div style="font-size:11px;font-weight:bold;color:#64748b;padding:4px;">${j}</div>`).join("")}`;

  // Cases vides avant le 1er
  for(let i=0; i<joursDebut; i++) html += `<div></div>`;

  for(let j=1; j<=nbJours; j++){
    const dateStr = `${annee}-${String(mois+1).padStart(2,"0")}-${String(j).padStart(2,"0")}`;
    const rdvsJour = rendezVous.filter(r => r.date === dateStr);
    const estAuj   = dateStr === aujour;
    const hasRdv   = rdvsJour.length > 0;
    const preview  = rdvsJour.slice(0,2).map(r=>`<div style="font-size:10px;background:#2563eb33;border-radius:3px;padding:1px 3px;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${r.heure||""} ${escHtml(r.client||r.motif||"")}</div>`).join("");

    html += `<div onclick="filtrerCalendrierJour('${dateStr}')" style="
      min-height:52px;padding:4px 5px;border-radius:6px;cursor:pointer;
      background:${estAuj?"#1e3a5f":hasRdv?"#1e293b":"transparent"};
      border:1px solid ${estAuj?"#38bdf8":hasRdv?"#334155":"transparent"};
      transition:background .15s;font-size:13px;font-weight:${estAuj?"bold":"normal"};
      color:${estAuj?"#38bdf8":"#f1f5f9"};
      " onmouseover="this.style.background='#1e293b'" onmouseout="this.style.background='${estAuj?"#1e3a5f":hasRdv?"#1e293b":"transparent"}'">
      ${j}${preview}
    </div>`;
  }
  html += `</div>`;
  zone.innerHTML = html;
}

function naviguerCalendrier(delta){
  const zone = document.getElementById("calendrierRdv");
  if(!zone) return;
  let annee = parseInt(zone.dataset.annee || new Date().getFullYear());
  let mois  = parseInt(zone.dataset.mois  || new Date().getMonth());
  mois += delta;
  if(mois < 0){ mois = 11; annee--; }
  if(mois > 11){ mois = 0;  annee++; }
  zone.dataset.annee = annee;
  zone.dataset.mois  = mois;
  renderCalendrierRdv();
}

function filtrerCalendrierJour(dateStr){
  // Filtrer la liste des RDV par date cliquée
  const zone = document.getElementById("listeRendezVous");
  if(!zone) return;
  const sorted = [...rendezVous].map((r,i)=>({...r,_i:i})).filter(r=>r.date===dateStr);
  if(sorted.length === 0){ renderRendezVous(); return; }
  zone.innerHTML = sorted.map(rdv=>`
    <tr style="background:#1e3a5f33;">
      <td>${escHtml(rdv.date)}</td>
      <td>${escHtml(rdv.heure)}</td>
      <td>${escHtml(rdv.client)}</td>
      <td>${escHtml(rdv.vehicule)}</td>
      <td>${escHtml(rdv.immat)}</td>
      <td>${escHtml(rdv.motif)}</td>
      <td><span class="badge badge-${rdv.statut==="Confirmé"?"success":rdv.statut==="Annulé"?"danger":"warning"}">${escHtml(rdv.statut)}</span></td>
      <td style="white-space:nowrap;"><button onclick="ouvrirGoogleAgenda(${rdv._i})" style="padding:4px 8px;font-size:12px;background:#16a34a;">📅 Google</button><button onclick="renderRendezVous()" style="font-size:11px;padding:3px 7px;">✖ Tout afficher</button></td>
    </tr>`).join("");
}

/* =====================================
   AGENDA / RENDEZ-VOUS
===================================== */


function pad2(n){ return String(n).padStart(2,"0"); }

function formatGoogleAgendaDate(date, heure, ajoutHeures=0){
  if(!date) return "";
  const h = heure || "09:00";
  const [annee, mois, jour] = date.split("-").map(Number);
  const [heures, minutes] = h.split(":").map(Number);
  const d = new Date(annee, (mois||1)-1, jour||1, heures||9, minutes||0, 0);
  if(ajoutHeures) d.setHours(d.getHours() + ajoutHeures);
  return `${d.getFullYear()}${pad2(d.getMonth()+1)}${pad2(d.getDate())}T${pad2(d.getHours())}${pad2(d.getMinutes())}00`;
}

function ouvrirGoogleAgenda(index){
  const rdv = rendezVous[index];
  if(!rdv){ toast("Rendez-vous introuvable", "error"); return; }
  if(!rdv.date){ toast("Date du rendez-vous obligatoire", "error"); return; }

  const debut = formatGoogleAgendaDate(rdv.date, rdv.heure, 0);
  const fin   = formatGoogleAgendaDate(rdv.date, rdv.heure, 1);
  const titre = `DA-Gestion - ${rdv.client || "Rendez-vous"}${rdv.vehicule ? " - " + rdv.vehicule : ""}`;
  const details = [
    rdv.client ? `Client : ${rdv.client}` : "",
    rdv.vehicule ? `Véhicule : ${rdv.vehicule}` : "",
    rdv.immat ? `Immatriculation : ${rdv.immat}` : "",
    rdv.motif ? `Motif : ${rdv.motif}` : "",
    rdv.statut ? `Statut : ${rdv.statut}` : "",
    "Créé depuis DA-Gestion"
  ].filter(Boolean).join("\n");

  const url = "https://calendar.google.com/calendar/render?action=TEMPLATE"
    + "&text=" + encodeURIComponent(titre)
    + "&dates=" + encodeURIComponent(`${debut}/${fin}`)
    + "&details=" + encodeURIComponent(details);
  window.open(url, "_blank");
}

function ajouterRendezVous(){
  const date     = document.getElementById("dateRdv").value;
  const heure    = document.getElementById("heureRdv").value;
  const client   = document.getElementById("clientRdv").value;
  const vehicule = document.getElementById("vehiculeRdv").value;
  const immat    = document.getElementById("immatRdv").value;
  const motif    = document.getElementById("motifRdv").value;
  const statut   = document.getElementById("statutRdv").value;

  if(!date){ toast("Date obligatoire", "error"); return; }

  rendezVous.push({ date, heure, client, vehicule, immat, motif, statut });
  saveData();
  renderRendezVous();
  renderRdvDuJour();
  toast("Rendez-vous ajouté ✓");
}

function supprimerRendezVous(index){
  confirmerAction("Supprimer ce rendez-vous ?", ()=>{ rendezVous.splice(index,1); saveData(); renderRendezVous(); renderRdvDuJour(); toast("Rendez-vous supprimé"); });
}

function renderRendezVous(){
  const zone = document.getElementById("listeRendezVous");
  if(!zone) return;
  // Tri par date puis heure
  const sorted = [...rendezVous].map((r,i)=>({...r,_i:i}))
    .sort((a,b)=>(a.date+a.heure).localeCompare(b.date+b.heure));
  zone.innerHTML = sorted.map(rdv=>`
    <tr>
      <td>${escHtml(rdv.date)}</td>
      <td>${escHtml(rdv.heure)}</td>
      <td>${escHtml(rdv.client)}</td>
      <td>${escHtml(rdv.vehicule)}</td>
      <td>${escHtml(rdv.immat)}</td>
      <td>${escHtml(rdv.motif)}</td>
      <td>
        <select onchange="changerStatutRdv(${rdv._i}, this.value)" style="padding:4px 8px;border-radius:6px;background:#1e293b;color:#f1f5f9;border:1px solid #334155;font-size:12px;">
          ${["Prévu","Confirmé","Terminé","Annulé"].map(s=>`<option value="${s}" ${rdv.statut===s?"selected":""}>${s}</option>`).join("")}
        </select>
      </td>
      <td style="white-space:nowrap;">
        <button onclick="ouvrirGoogleAgenda(${rdv._i})" style="padding:4px 8px;font-size:12px;background:#16a34a;">📅 Google</button>
        <button onclick="modifierRendezVous(${rdv._i})" style="padding:4px 8px;font-size:12px;">✏️</button>
        <button class="delete-btn" onclick="supprimerRendezVous(${rdv._i})" style="padding:4px 8px;font-size:12px;">🗑</button>
      </td>
    </tr>
  `).join("");
}

function changerStatutRdv(index, statut){
  if(!rendezVous[index]) return;
  rendezVous[index].statut = statut;
  saveData();
  toast("Statut mis à jour : " + statut);
}

function modifierRendezVous(index){
  const r = rendezVous[index];
  if(!r) return;
  const esc = v => (v||"").replace(/"/g,"&quot;");
  ouvrirModal("✏️ Modifier le rendez-vous", `
    <div class="form-grid">
      <div style="position:relative;">
        <label style="position:absolute;top:-9px;left:10px;font-size:10px;color:#64748b;background:#1e293b;padding:0 4px;z-index:1;">📅 Date</label>
        <input type="date" id="mrdv_date" value="${esc(r.date)}" style="width:100%;padding-top:14px;">
      </div>
      <input type="time" id="mrdv_heure" value="${esc(r.heure)}" placeholder="Heure">
      <input type="text" id="mrdv_client" value="${esc(r.client)}" placeholder="Client">
      <input type="text" id="mrdv_vehicule" value="${esc(r.vehicule)}" placeholder="Véhicule">
      <input type="text" id="mrdv_immat" value="${esc(r.immat)}" placeholder="Immatriculation">
      <input type="text" id="mrdv_motif" value="${esc(r.motif)}" placeholder="Motif">
      <select id="mrdv_statut">
        ${["Prévu","Confirmé","Terminé","Annulé"].map(s=>`<option value="${s}" ${r.statut===s?"selected":""}>${s}</option>`).join("")}
      </select>
    </div>`,
    function(){
      const get = id => document.getElementById(id)?.value||"";
      if(!get("mrdv_date")){ toast("Date obligatoire","error"); return false; }
      rendezVous[index] = { ...r,
        date: get("mrdv_date"), heure: get("mrdv_heure"),
        client: get("mrdv_client"), vehicule: get("mrdv_vehicule"),
        immat: get("mrdv_immat"), motif: get("mrdv_motif"),
        statut: get("mrdv_statut")
      };
      saveData();
      renderRendezVous();
      renderRdvDuJour();
      renderCalendrierRdv();
      toast("Rendez-vous modifié ✓");
    }
  );
}

function renderRdvDuJour(){
  const zone = document.getElementById("rdvDuJour");
  if(!zone) return;
  const aujourd = new Date().toISOString().split("T")[0];
  const rdvJour = rendezVous.filter(r => r.date === aujourd);
  if(rdvJour.length === 0){
    zone.innerHTML = `<tr><td colspan="4" style="color:var(--muted);text-align:center;">Aucun rendez-vous aujourd'hui</td></tr>`;
    return;
  }
  zone.innerHTML = rdvJour.map(rdv=>`
    <tr>
      <td><b>${escHtml(rdv.heure)}</b></td>
      <td>${escHtml(rdv.client)}</td>
      <td>${escHtml(rdv.vehicule)}</td>
      <td>${escHtml(rdv.motif)}</td>
    </tr>
  `).join("");
}

function creerRdvDepuisDossier(index){
  const d = dossiers[index];
  showPage("agenda");
  document.getElementById("clientRdv").value  = d.client||"";
  document.getElementById("vehiculeRdv").value = d.vehicule||"";
  document.getElementById("immatRdv").value    = d.immat||"";
  document.getElementById("motifRdv").value    = "Remplacement "+(d.vitrage||"");
}

/* =====================================
   INITIALISATION
===================================== */


function verifierAlerteRdv(){
  const auj = new Date();
  auj.setHours(0,0,0,0);
  const demain = new Date(auj); demain.setDate(demain.getDate()+1);
  const surlendemain = new Date(auj); surlendemain.setDate(surlendemain.getDate()+2);

  const rdvProches = (rendezVous||[]).filter(r=>{
    if(!r.date) return false;
    const d = new Date(r.date); d.setHours(0,0,0,0);
    return d >= auj && d < surlendemain;
  });

  if(rdvProches.length === 0) return;

  const msgs = rdvProches.map(r=>{
    const d = new Date(r.date); d.setHours(0,0,0,0);
    const quand = d.getTime() === auj.getTime() ? "📅 AUJOURD'HUI" : "📅 DEMAIN";
    return `${quand} — ${r.heure||""} — ${r.client||r.description||"RDV"}`;
  }).join("\n");

  setTimeout(()=> toast("🔔 " + rdvProches.length + " RDV aujourd'hui/demain", "success"), 1500);

  // Badge dans le menu
  const lienAgenda = document.querySelector(".sidebar nav a[onclick*=\"agenda\"]");
  if(lienAgenda && !lienAgenda.querySelector(".badge-rdv")){
    const badge = document.createElement("span");
    badge.className = "badge-rdv";
    badge.textContent = rdvProches.length;
    badge.style.cssText = "background:#ef4444;color:#fff;border-radius:9999px;padding:1px 6px;font-size:11px;margin-left:6px;font-weight:bold;";
    lienAgenda.appendChild(badge);
  }
}

function initialiserApplication(){
  // Charger documents sauvegardés
  documents = JSON.parse(localStorage.getItem("documents")) || [];

  normaliserNumerosDossiers();
  synchroniserClientsDepuisDossiers();

  gestionFranchise();
  renderRdvDuJour();
  renderClients();
  renderVehicules();
  renderAssurances();
  chargerListeAssurances();
  renderDossiers();
  renderDossiersRecent();
  renderRendezVous();
  chargerEntreprise();
  chargerDossiersSelect();
  renderDocuments();
  majDashboard();

  // Marquer Dashboard comme actif
  const firstLink = document.querySelector(".sidebar nav a");
  if(firstLink) firstLink.classList.add("active");

  showPage("dashboard");

  verifierAlerteRdv();
  // Initialiser Firebase en arrière-plan
  initFirebase();
  // Sauvegarde automatique toutes les 3 minutes
  setInterval(()=>{
    if(typeof _dataSaved !== "undefined" && _dataSaved === false){
      saveData();
      toast("💾 Sauvegarde automatique ✓");
    }
  }, 3 * 60 * 1000);
}

document.addEventListener("keydown", function(e){
  if(e.key === "Escape"){
    const modal = document.getElementById("modalOverlay");
    if(modal && modal.style.display !== "none") fermerModal();
    const panneau = document.getElementById("panneauTransfertDoc");
    if(panneau && panneau.style.display !== "none") panneau.style.display = "none";
  }
});

document.addEventListener("DOMContentLoaded", function(){
  // Vérifier si une session est active (même onglet)
  const session = getSessionUtilisateur();
  if(session){
    document.getElementById("loginScreen").style.display = "none";
    document.getElementById("appContainer").style.display = "";
    afficherUtilisateurConnecte(session);
    initialiserApplication();
  } else {
    afficherEcranLogin();
  }
});

/* =====================================
   SAUVEGARDE AUTOMATIQUE (5 min)
===================================== */

setInterval(function(){
  saveData();
  console.log("💾 Sauvegarde automatique effectuée");
}, 300000);

/* =====================================
   DEVIS / FACTURE — LIGNES
===================================== */

let lignesDocument = [];

function ajouterLigne(){
  const designation = document.getElementById("ligneDesignation").value.trim();
  const type        = document.getElementById("ligneType").value;
  const qte         = parseFloat(document.getElementById("ligneQte").value) || 1;
  const prixHT      = parseFloat(document.getElementById("lignePrixHT").value) || 0;
  const tva         = parseFloat(document.getElementById("ligneTVA").value) || 20;

  if(!designation){ toast("Saisissez une désignation", "error"); return; }

  lignesDocument.push({ designation, type, qte, prixHT, tva });
  renderLignes();

  document.getElementById("ligneDesignation").value = "";
  document.getElementById("ligneQte").value = "1";
  document.getElementById("lignePrixHT").value = "";
}

function supprimerLigne(i){
  lignesDocument.splice(i, 1);
  renderLignes();
}

function renderLignes(){
  const tbody = document.getElementById("lignesDocument");
  if(!tbody) return;

  let totalHT  = 0;
  let totalTVA = 0;

  tbody.innerHTML = lignesDocument.map((l, i)=>{
    const ht  = l.qte * l.prixHT;
    const tvaAmt = ht * l.tva / 100;
    const ttc = ht + tvaAmt;
    totalHT  += ht;
    totalTVA += tvaAmt;
    return `<tr class="ligne-${l.type}">
      <td>${escHtml(l.designation)}</td>
      <td>${l.type === "mo" ? "Main d'œuvre" : "Produit"}</td>
      <td>${l.qte}</td>
      <td>${l.prixHT.toFixed(2)} €</td>
      <td>${l.tva} %</td>
      <td>${ht.toFixed(2)} €</td>
      <td><b>${ttc.toFixed(2)} €</b></td>
      <td><button class="delete-btn" onclick="supprimerLigne(${i})" style="padding:4px 8px;">🗑</button></td>
    </tr>`;
  }).join("");

  const totalTTC = totalHT + totalTVA;
  const fmt = n => n.toLocaleString("fr-FR",{minimumFractionDigits:2,maximumFractionDigits:2})+" €";
  const setEl = (id,v) => { const el=document.getElementById(id); if(el) el.textContent=v; };
  setEl("totalHT",  fmt(totalHT));
  setEl("totalTVA", fmt(totalTVA));
  setEl("totalTTC", fmt(totalTTC));
}

function resetDocument(){
  lignesDocument = [];
  renderLignes();
  ["titreDocument","technicienDocument","dateDocument","rechercheDossierDevis"].forEach(id=>{
    const el = document.getElementById(id); if(el) el.value="";
  });
  const ds = document.getElementById("dossierRattache");
  if(ds) ds.value="";
  const info = document.getElementById("dossierSelectionneInfo");
  if(info) info.style.display="none";
  const zone = document.getElementById("resultatsRechercheDevis");
  if(zone){ zone.style.display="none"; zone.innerHTML=""; }
}

/* =====================================
   CHARGER DOSSIERS DANS SELECT
===================================== */

function chargerDossiersSelect(){
  // Met à jour le select caché (utilisé pour la sauvegarde)
  const select = document.getElementById("dossierRattache");
  if(!select) return;
  const current = select.value;
  select.innerHTML = '<option value="">-- Rattacher à un dossier --</option>';
  dossiers.forEach((d,i)=>{
    const opt = document.createElement("option");
    opt.value = i;
    opt.textContent = d.numero + " — " + d.client;
    select.appendChild(opt);
  });
  if(current !== "") select.value = current;
}

/* =====================================
   RECHERCHE DOSSIER DANS DEVIS/FACTURE
===================================== */

function filtrerDossiersDevis(){
  const q      = (document.getElementById("rechercheDossierDevis")?.value || "").toLowerCase().trim();
  const zone   = document.getElementById("resultatsRechercheDevis");
  if(!zone) return;

  if(!q){ zone.style.display="none"; zone.innerHTML=""; return; }

  const resultats = dossiers
    .map((d,i) => ({d, i}))
    .filter(({d}) =>
      (d.client||"").toLowerCase().includes(q) ||
      (d.numero||"").toLowerCase().includes(q) ||
      (d.immat||"").toLowerCase().includes(q)  ||
      (d.assurance||"").toLowerCase().includes(q)
    )
    .slice(0, 8);

  if(resultats.length === 0){
    zone.style.display = "block";
    zone.innerHTML = `<div style="padding:12px 16px;color:var(--muted);font-size:13px;">Aucun dossier trouvé</div>`;
    return;
  }

  zone.style.display = "block";
  zone.innerHTML = resultats.map(({d, i}) => `
    <div onclick="selectionnerDossierDevis(${i})"
      style="padding:12px 16px;cursor:pointer;border-bottom:1px solid #1f2937;transition:background .15s;"
      onmouseover="this.style.background='#1e3a5f'" onmouseout="this.style.background=''">
      <div style="font-weight:bold;color:#38bdf8;font-size:14px;">${escHtml(d.numero)}</div>
      <div style="color:#f1f5f9;font-size:13px;">👤 ${escHtml(d.client)}</div>
      <div style="color:var(--muted);font-size:12px;">🚗 ${escHtml(d.vehicule||"")} ${escHtml(d.immat||"")} &nbsp;|&nbsp; 🛡 ${escHtml(d.assurance||"")}</div>
    </div>
  `).join("");
}

function selectionnerDossierDevis(index){
  const d = dossiers[index];

  // Mettre à jour le select caché
  const select = document.getElementById("dossierRattache");
  if(select) select.value = index;

  // Cacher les résultats et vider la recherche
  const zone = document.getElementById("resultatsRechercheDevis");
  if(zone){ zone.style.display="none"; zone.innerHTML=""; }
  const input = document.getElementById("rechercheDossierDevis");
  if(input) input.value = "";

  // Afficher le bloc info dossier sélectionné
  const info = document.getElementById("dossierSelectionneInfo");
  if(info) info.style.display = "block";

  const set = (id, val) => { const el=document.getElementById(id); if(el) el.textContent=val; };
  set("infoNumeroDossier",  d.numero);
  set("infoClientDossier",  "👤 " + d.client + (d.telephone ? " — " + d.telephone : ""));
  set("infoVehiculeDossier","🚗 " + (d.vehicule||"") + " " + (d.modele||"") + " — " + (d.immat||""));
  set("infoAssuranceDossier","🛡 " + (d.assurance||"—") + " | N° sinistre : " + (d.sinistre||"—"));

  // Pré-remplir le titre si vide
  const titre = document.getElementById("titreDocument");
  if(titre && !titre.value){
    titre.value = (d.vitrage ? "Remplacement " + d.vitrage : "Réparation vitrage") + " — " + d.immat;
  }

  // Pré-remplir technicien si vide
  const tech = document.getElementById("technicienDocument");
  if(tech && !tech.value && d.technicien) tech.value = d.technicien;

  // Date du jour si vide
  const date = document.getElementById("dateDocument");
  if(date && !date.value) date.value = new Date().toISOString().split("T")[0];

  toast("Dossier " + d.numero + " rattaché ✓");
}

function retirerDossierRattache(){
  const select = document.getElementById("dossierRattache");
  if(select) select.value = "";
  const info = document.getElementById("dossierSelectionneInfo");
  if(info) info.style.display = "none";
  const input = document.getElementById("rechercheDossierDevis");
  if(input) input.value = "";
  toast("Dossier retiré");
}

/* =====================================
   ENVOI DEVIS / FACTURE VERS DOSSIER
===================================== */

function appliquerDocumentAuDossier(doc){
  if(!doc || doc.dossierIdx === null || !dossiers[doc.dossierIdx]) return false;
  const d = dossiers[doc.dossierIdx];
  const montant = Number(doc.totalTTC || 0).toFixed(2);

  if(doc.type === "devis"){
    d.devis = montant;
  } else {
    d.facture = montant;
    if(d.statut !== "Facturé") d.statut = "Facturé";
  }

  d.technicien = doc.technicien || d.technicien || "";
  if(doc.date) d.dateReparation = d.dateReparation || doc.date;

  saveData();
  renderDossiers();
  renderDossiersRecent();
  majDashboard();
  return true;
}

function rattacherDocumentAuDossier(i){
  if(appliquerDocumentAuDossier(documents[i])){
    toast((documents[i].type === "devis" ? "Devis" : "Facture") + " ajouté au dossier ✓");
  } else {
    toast("Aucun dossier rattaché à ce document", "error");
  }
}

function ouvrirRattachementDossier(idxDoc){
  const doc = documents[idxDoc];
  if(!doc) return;

  // Supprimer tout panneau déjà ouvert
  document.querySelectorAll(".panneau-rattachement").forEach(el => el.remove());

  const type  = doc.type === "devis" ? "Devis" : "Facture";
  const label = `${type} — ${doc.titre||""} — ${doc.totalTTC.toLocaleString("fr-FR",{minimumFractionDigits:2})} €`;

  const options = dossiers.map((d,i) =>
    `<option value="${i}" ${doc.dossierIdx===i?"selected":""}>N°${d.numero} — ${escHtml(d.client)} — ${escHtml(d.vehicule)} (${escHtml(d.immat||"—")})</option>`
  ).join("");

  const panneau = document.createElement("tr");
  panneau.className = "panneau-rattachement";
  panneau.innerHTML = `
    <td colspan="6" style="background:#1e1040;border:1px solid #7c3aed55;padding:16px 20px;">
      <div style="display:flex;flex-direction:column;gap:12px;">
        <div style="color:#a78bfa;font-weight:bold;">📂 Rattacher « ${escHtml(label)} » à un dossier</div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;">
          <select id="selectDossierRattach_${idxDoc}" style="flex:1;min-width:260px;font-size:13px;">
            <option value="">-- Choisir un dossier --</option>
            ${options}
          </select>
          <button onclick="confirmerRattachement(${idxDoc})" style="background:#7c3aed;">✅ Confirmer</button>
          <button onclick="this.closest('tr').remove()">✖ Annuler</button>
          ${doc.dossierIdx !== null ? `<button onclick="retirerRattachementDoc(${idxDoc})" class="delete-btn">🗑 Retirer le rattachement</button>` : ""}
        </div>
        ${doc.dossierIdx !== null ? `<div style="font-size:12px;color:#38bdf8;">Actuellement rattaché au dossier N°${escHtml(dossiers[doc.dossierIdx]?.numero||"?")}</div>` : ""}
      </div>
    </td>`;

  // Insérer le panneau juste après la ligne du document
  const rows = document.querySelectorAll("#listeDocuments tr");
  if(rows[idxDoc]) rows[idxDoc].after(panneau);
}

function confirmerRattachement(idxDoc){
  const select = document.getElementById("selectDossierRattach_" + idxDoc);
  const idxDossier = select?.value;
  if(idxDossier === "" || idxDossier === undefined){ toast("Choisissez un dossier", "error"); return; }

  const doc = documents[idxDoc];
  const dossier = dossiers[Number(idxDossier)];
  if(!doc || !dossier){ toast("Introuvable", "error"); return; }

  // Mettre à jour le document
  doc.dossierIdx    = Number(idxDossier);
  doc.dossierNumero = dossier.numero || "";
  localStorage.setItem("documents", JSON.stringify(documents));

  // Appliquer au dossier (met à jour devis/facture + statut)
  appliquerDocumentAuDossier(doc);

  renderDocuments();
  majDashboard();
  toast(`${doc.type === "devis" ? "Devis" : "Facture"} rattaché au dossier N°${dossier.numero} ✓`);
}

function retirerRattachementDoc(idxDoc){
  const doc = documents[idxDoc];
  if(!doc) return;
  confirmerAction("Retirer le rattachement de ce document ?", ()=>{ doc.dossierIdx=null; doc.dossierNumero=""; localStorage.setItem("documents",JSON.stringify(documents)); renderDocuments(); toast("Rattachement retiré"); });
}

/* =====================================
   SAUVEGARDER DOCUMENT
===================================== */

let documents = JSON.parse(localStorage.getItem("documents")) || [];

function genererNumeroDocument(type){
  const annee = new Date().getFullYear();
  const prefix = type === "facture" ? "FAC" : "DEV";
  const existants = documents.filter(d => d.id && d.id.startsWith(prefix + "-" + annee));
  const max = existants.reduce((acc, d) => {
    const num = parseInt((d.id||"").split("-").pop()) || 0;
    return Math.max(acc, num);
  }, 0);
  return `${prefix}-${annee}-${String(max + 1).padStart(3, "0")}`;
}

function majNumeroDocument(){
  const type = document.getElementById("typeDocument")?.value || "devis";
  const el = document.getElementById("numeroDocument");
  if(el) el.value = genererNumeroDocument(type);
}

function sauvegarderDocument(){
  if(lignesDocument.length === 0){ toast("Ajoutez au moins une ligne", "error"); return; }

  const dossierIdx = document.getElementById("dossierRattache").value;
  const titre      = document.getElementById("titreDocument").value.trim();
  const type       = document.getElementById("typeDocument").value;
  const date       = document.getElementById("dateDocument").value || new Date().toISOString().split("T")[0];
  const technicien = document.getElementById("technicienDocument").value.trim();

  let totalHT=0, totalTVA=0;
  lignesDocument.forEach(l=>{
    const ht = l.qte * l.prixHT;
    totalHT  += ht;
    totalTVA += ht * l.tva / 100;
  });

  const doc = {
    id: genererNumeroDocument(type),
    type, titre, date, technicien,
    dossierIdx: dossierIdx !== "" ? Number(dossierIdx) : null,
    dossierNumero: dossierIdx !== "" ? (dossiers[Number(dossierIdx)]?.numero||"") : "",
    lignes: [...lignesDocument],
    totalHT, totalTVA, totalTTC: totalHT + totalTVA
  };

  documents.push(doc);
  localStorage.setItem("documents", JSON.stringify(documents));
  appliquerDocumentAuDossier(doc);
  renderDocuments();
  majDashboard();
  toast("Document sauvegardé ✓ — " + doc.id + (doc.dossierIdx !== null ? " — ajouté au dossier" : ""));
  if(typeof logAction==="function") logAction("Document sauvegardé", doc.id+" — "+doc.type+" — "+doc.totalTTC.toFixed(2)+"€");
}

function supprimerDocument(i){
  confirmerAction("Supprimer ce document ?", ()=>{
    documents.splice(i, 1);
    localStorage.setItem("documents", JSON.stringify(documents));
    renderDocuments();
    majDashboard();
    toast("Document supprimé");
  });
}

function chargerDocument(i){
  const doc = documents[i];
  lignesDocument = [...doc.lignes];
  renderLignes();
  const set = (id,v) => { const el=document.getElementById(id); if(el) el.value=v; };
  set("titreDocument",      doc.titre);
  set("typeDocument",       doc.type);
  set("dateDocument",       doc.date);
  set("technicienDocument", doc.technicien||"");

  // Restaurer le dossier rattaché
  if(doc.dossierIdx !== null && dossiers[doc.dossierIdx]){
    const el = document.getElementById("dossierRattache");
    if(el) el.value = doc.dossierIdx;
    selectionnerDossierDevis(doc.dossierIdx);
  } else {
    retirerDossierRattache();
  }

  showPage("devisFacture");
  toast("Document chargé — modifiez et regénérez");
}

function ouvrirTransfertVersDossier(){
  const panneau = document.getElementById("panneauTransfertDoc");
  if(!panneau) return;
  const isOpen = panneau.style.display !== "none";
  panneau.style.display = isOpen ? "none" : "";
  if(!isOpen){
    _remplirSelectTransfert("");
    document.getElementById("rechercheTransfertDossier").value = "";
    document.getElementById("infoTransfertDossier").textContent = "";
  }
}

function _remplirSelectTransfert(filtre){
  const select = document.getElementById("selectTransfertDossier");
  if(!select) return;
  const f = (filtre||"").toLowerCase();
  const type = document.getElementById("typeDossierTransfert")?.value || "vitrage";
  select.innerHTML = '<option value="">-- Choisir un dossier --</option>';
  const liste = type === "mecanique" ? dossiersMecanique : dossiers;
  liste.forEach((d,i) => {
    const texte = `${d.numero} ${d.client} ${d.vehicule||""} ${d.immat||""}`.toLowerCase();
    if(f && !texte.includes(f)) return;
    const opt = document.createElement("option");
    opt.value = i;
    if(type === "mecanique"){
      opt.textContent = `${d.numero} — ${d.client} — ${d.vehicule||"—"} (${d.immat||"—"})`;
    } else {
      opt.textContent = `N°${d.numero} — ${d.client} — ${d.vehicule} (${d.immat||"—"})`;
    }
    select.appendChild(opt);
  });
  _majInfoTransfert();
}

function filtrerDossiersTransfert(){
  const val = document.getElementById("rechercheTransfertDossier")?.value || "";
  _remplirSelectTransfert(val);
}

function _majInfoTransfert(){
  const select = document.getElementById("selectTransfertDossier");
  const info   = document.getElementById("infoTransfertDossier");
  const typeDoc  = document.getElementById("typeDocument")?.value;
  const typeDos  = document.getElementById("typeDossierTransfert")?.value || "vitrage";
  if(!select || !info) return;
  const idx = select.value;
  if(idx === ""){ info.textContent = ""; return; }
  const liste = typeDos === "mecanique" ? dossiersMecanique : dossiers;
  const d = liste[Number(idx)];
  if(!d) return;
  const label = typeDoc === "facture" ? "Facture" : "Devis";
  const actuel = typeDoc === "facture" ? (d.facture||"—") : (d.devis||"—");
  const icon = typeDos === "mecanique" ? "🔩" : "🪟";
  info.innerHTML = `${icon} Dossier <b>${escHtml(d.numero)}</b> — ${escHtml(d.client)} — colonne <b>${label}</b> actuelle : <b>${actuel} €</b>`;
}

function confirmerTransfertVersDossier(){
  const select = document.getElementById("selectTransfertDossier");
  const idxDossier = select?.value;
  if(idxDossier === "" || idxDossier === undefined || idxDossier === null){
    toast("Choisissez un dossier", "error"); return;
  }

  const typeDoc = document.getElementById("typeDocument")?.value;
  const typeDos = document.getElementById("typeDossierTransfert")?.value || "vitrage";

  let totalHT = 0, totalTVA = 0;
  lignesDocument.forEach(l => {
    const ht = l.qte * l.prixHT;
    totalHT  += ht;
    totalTVA += ht * l.tva / 100;
  });
  const totalTTC = totalHT + totalTVA;

  if(lignesDocument.length === 0){ toast("Aucune ligne dans le document", "error"); return; }

  const liste = typeDos === "mecanique" ? dossiersMecanique : dossiers;
  const d = liste[Number(idxDossier)];
  if(!d){ toast("Dossier introuvable", "error"); return; }

  const icon = typeDos === "mecanique" ? "🔩" : "🪟";
  confirmerAction(`Transférer ce ${typeDoc==="facture"?"facture":"devis"} (${totalTTC.toLocaleString("fr-FR",{minimumFractionDigits:2})} €) vers le dossier ${icon} ${d.numero} — ${d.client} ?`, ()=>{
    if(typeDos === "mecanique"){
      const lignes = lignesDocumentVersLignesMecanique();
      if(typeDoc === "facture"){
        if(!Array.isArray(d.lignesFactureMecanique)) d.lignesFactureMecanique = [];
        d.lignesFactureMecanique.push(...lignes);
        if(d.statut !== "Facturé") d.statut = "Facturé";
      } else {
        if(!Array.isArray(d.lignesDevisMecanique)) d.lignesDevisMecanique = [];
        d.lignesDevisMecanique.push(...lignes);
      }
      recalculerTotauxMecanique(d);
    } else if(typeDoc === "facture"){
      d.facture = totalTTC.toFixed(2);
      if(d.statut !== "Facturé") d.statut = "Facturé";
    } else {
      d.devis = totalTTC.toFixed(2);
    }
    saveData();
    if(typeDos === "mecanique"){
      renderDossiersMecanique();
      majCompteursMecanique();
    } else {
      renderDossiers();
      renderDossiersRecent();
      majDashboard();
    }
    document.getElementById("panneauTransfertDoc").style.display = "none";
    document.getElementById("infoTransfertDossier").textContent = "";
    toast(`${typeDoc==="facture"?"Facture":"Devis"} transféré vers ${d.numero} ✓`);
  });
}

// Mettre à jour l'info quand on change la sélection
document.addEventListener("change", function(e){
  if(e.target && e.target.id === "selectTransfertDossier") _majInfoTransfert();
});

function renderDocuments(){
  const tbody = document.getElementById("listeDocuments");
  if(!tbody) return;
  tbody.innerHTML = documents.map((doc,i)=>`
    <tr>
      <td>${escHtml(doc.date)}</td>
      <td><span class="badge badge-${doc.type}">${doc.type==="devis"?"Devis":"Facture"}</span></td>
      <td>${escHtml(doc.titre||"—")}</td>
      <td>${escHtml(doc.dossierNumero||"—")}</td>
      <td><b>${doc.totalTTC.toLocaleString("fr-FR",{minimumFractionDigits:2})} €</b></td>
      <td style="white-space:nowrap">
        <button onclick="chargerDocument(${i})">✏ Modifier</button>
        <button onclick="genererPdfDocumentSaved(${i})">📄 PDF</button>
        <button onclick="ouvrirRattachementDossier(${i})" style="background:#7c3aed;">📂 Rattacher dossier</button>
        <button class="delete-btn" onclick="supprimerDocument(${i})">🗑</button>
      </td>
    </tr>
  `).join("");
}

/* =====================================
   PDF DEVIS / FACTURE LIGNES
===================================== */

function genererPdfDocument(){
  _genPdf(null);
}

function genererPdfDocumentSaved(i){
  _genPdf(documents[i]);
}

function _genPdf(savedDoc){
  if(!window.jspdf){ toast("Bibliothèque PDF non chargée","error"); return; }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  const lignes     = savedDoc ? savedDoc.lignes  : lignesDocument;
  const type       = savedDoc ? savedDoc.type    : document.getElementById("typeDocument").value;
  const titre      = savedDoc ? savedDoc.titre   : document.getElementById("titreDocument").value;
  const dateDoc    = savedDoc ? savedDoc.date    : document.getElementById("dateDocument").value;
  const technicien = savedDoc ? savedDoc.technicien : document.getElementById("technicienDocument").value;
  const dossierIdx = savedDoc ? savedDoc.dossierIdx : (()=>{const v=document.getElementById("dossierRattache").value; return v!==""?Number(v):null;})();
  const dossier    = dossierIdx !== null ? dossiers[dossierIdx] : null;

  // En-tête société
  if(entreprise.logo){
    try{ doc.addImage(entreprise.logo,"JPEG",14,10,30,18); }catch(e){}
  }
  doc.setFontSize(9); doc.setTextColor(150);
  doc.text(entreprise.nom||"",     140,14);
  doc.text(entreprise.adresse||"", 140,19);
  doc.text(entreprise.telephone||"",140,24);
  doc.text(entreprise.email||"",   140,29);
  doc.text("SIRET : "+(entreprise.siret||""),140,34);

  // Titre
  doc.setTextColor(0); doc.setFontSize(22); doc.setFont(undefined,"bold");
  doc.text(type==="devis" ? "DEVIS" : "FACTURE", 105, 50, {align:"center"});

  doc.setFontSize(10); doc.setFont(undefined,"normal");
  doc.text("Date : "+(dateDoc||new Date().toLocaleDateString("fr-FR")), 14, 60);
  if(titre) doc.text("Objet : "+titre, 14, 66);
  if(technicien) doc.text("Technicien : "+technicien, 14, 72);

  // Infos client & dossier
  if(dossier){
    let y = 82;
    doc.setFont(undefined,"bold"); doc.text("CLIENT", 14, y);
    doc.setFont(undefined,"normal");
    doc.text(dossier.client||"",     14, y+6);
    doc.text(dossier.adresse||"",    14, y+12);
    doc.text(dossier.telephone||"",  14, y+18);
    doc.text("Véhicule : "+(dossier.vehicule||"")+" "+(dossier.immat||""), 14, y+24);
    doc.text("N° Dossier : "+dossier.numero, 14, y+30);
    doc.text("N° Sinistre : "+(dossier.sinistre||"—"), 14, y+36);
    doc.text("Assurance : "+(dossier.assurance||"—"), 14, y+42);
  }

  // Tableau lignes
  let y = dossier ? 140 : 85;
  doc.setFillColor(30,41,59); doc.setTextColor(255);
  doc.rect(14, y, 182, 8, "F");
  doc.setFontSize(9); doc.setFont(undefined,"bold");
  doc.text("Désignation",   16, y+5.5);
  doc.text("Type",          90, y+5.5);
  doc.text("Qté",          118, y+5.5);
  doc.text("PU HT",        128, y+5.5);
  doc.text("TVA",          150, y+5.5);
  doc.text("Total HT",     164, y+5.5);
  doc.text("Total TTC",    183, y+5.5);

  doc.setTextColor(0); doc.setFont(undefined,"normal"); y += 10;
  let totalHT=0, totalTVA=0;

  lignes.forEach((l, idx)=>{
    const ht = l.qte * l.prixHT;
    const tvaAmt = ht * l.tva / 100;
    const ttc = ht + tvaAmt;
    totalHT  += ht;
    totalTVA += tvaAmt;
    if(idx % 2 === 0){ doc.setFillColor(245,247,250); doc.rect(14,y-5,182,8,"F"); }
    doc.text(String(l.designation).substring(0,38), 16,  y);
    doc.text(l.type==="mo"?"Main d'œuvre":"Produit",    90,  y);
    doc.text(String(l.qte),                         122, y);
    doc.text(l.prixHT.toFixed(2)+" €",              128, y);
    doc.text(l.tva+"%",                              153, y);
    doc.text(ht.toFixed(2)+" €",                    164, y);
    doc.text(ttc.toFixed(2)+" €",                   183, y);
    y += 10;
    if(y > 270){ doc.addPage(); y = 20; }
  });

  // Totaux
  y += 4;
  const totalTTC = totalHT + totalTVA;
  doc.setDrawColor(200); doc.line(14, y, 196, y); y+=6;
  doc.setFont(undefined,"bold");
  doc.text("Total HT :",  140, y); doc.text(totalHT.toFixed(2)+" €",  185, y, {align:"right"}); y+=7;
  doc.text("TVA :",       140, y); doc.text(totalTVA.toFixed(2)+" €", 185, y, {align:"right"}); y+=7;
  doc.setFontSize(13);
  doc.text("Total TTC :", 140, y); doc.text(totalTTC.toFixed(2)+" €", 185, y, {align:"right"});

  doc.save((type==="devis"?"Devis":"Facture")+"_"+(dossier?dossier.numero:"")+"_"+Date.now()+".pdf");
}

/* =====================================
   CESSION DE CREANCES
===================================== */

function genererCessionCreances(index){
  const d = dossiers[index];
  const fenetre = window.open("", "_blank");

  const ent = entreprise;
  const dateAuj = new Date().toLocaleDateString("fr-FR");

  fenetre.document.write(`<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Cession de Créances</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box;}
  body{font-family:Arial,sans-serif;font-size:13px;padding:30px;color:#111;}
  h1{text-align:center;font-size:20px;margin:18px 0;text-transform:uppercase;letter-spacing:1px;}
  h2{font-size:14px;background:#eee;padding:6px 10px;margin:16px 0 8px;border-left:4px solid #2563eb;}
  .bloc{display:grid;grid-template-columns:1fr 1fr;gap:8px 30px;margin-bottom:10px;}
  .bloc p{margin-bottom:4px;}
  .bloc p b{display:inline-block;min-width:120px;}
  .entete{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;padding-bottom:14px;border-bottom:2px solid #2563eb;}
  .entete-left{font-size:12px;line-height:1.7;}
  .entete-right{font-size:12px;line-height:1.7;text-align:right;}
  .entete h3{font-size:16px;color:#2563eb;}
  .montant{background:#f0f7ff;border:1px solid #2563eb;border-radius:6px;padding:12px 18px;margin:16px 0;}
  .montant span{font-size:22px;font-weight:bold;color:#2563eb;}
  .legal{font-size:11px;line-height:1.6;color:#444;border:1px solid #ccc;padding:12px;border-radius:4px;margin:18px 0;}
  .signatures{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:30px;}
  .sig-box{border-top:1px solid #333;padding-top:8px;min-height:80px;}
  .sig-box p{font-size:11px;color:#555;}
  @media print{body{padding:18px;}}
</style>
</head>
<body>

<div class="entete">
  <div class="entete-left">
    <h3>${escHtml(ent.nom||"DA-Gestion")}</h3>
    <p>${escHtml(ent.adresse||"")}</p>
    <p>Tél : ${escHtml(ent.telephone||"")}</p>
    <p>Email : ${escHtml(ent.email||"")}</p>
    <p>SIRET : ${escHtml(ent.siret||"")}</p>
  </div>
  <div class="entete-right">
    <p><b>N° Dossier :</b> ${escHtml(d.numero)}</p>
    <p><b>Date :</b> ${dateAuj}</p>
    <p><b>N° Sinistre :</b> ${escHtml(d.sinistre||"—")}</p>
    <p><b>N° Contrat :</b> ${escHtml(d.contrat||"—")}</p>
  </div>
</div>

<h1>Cession de Créances Bris de Glace</h1>

<h2>👤 Le Cédant (Assuré)</h2>
<div class="bloc">
  <p><b>Nom :</b> ${escHtml(d.client)}</p>
  <p><b>Adresse :</b> ${escHtml(d.adresse||"—")}</p>
  <p><b>Téléphone :</b> ${escHtml(d.telephone||"—")}</p>
  <p><b>Véhicule :</b> ${escHtml(d.vehicule||"")} ${escHtml(d.modele||"")}</p>
  <p><b>Immatriculation :</b> ${escHtml(d.immat||"—")}</p>
</div>

<h2>🏢 Le Cessionnaire (Réparateur)</h2>
<div class="bloc">
  <p><b>Société :</b> ${escHtml(ent.nom||"")}</p>
  <p><b>Adresse :</b> ${escHtml(ent.adresse||"")}</p>
  <p><b>Téléphone :</b> ${escHtml(ent.telephone||"")}</p>
  <p><b>Email :</b> ${escHtml(ent.email||"")}</p>
  <p><b>SIRET :</b> ${escHtml(ent.siret||"")}</p>
</div>

<h2>🛡 Le Débiteur cédé (Assureur)</h2>
<div class="bloc">
  <p><b>Assurance :</b> ${escHtml(d.assurance||"—")}</p>
  <p><b>Adresse :</b> ${escHtml(d.adresseAssurance||"—")}</p>
  <p><b>Agence / Courtier :</b> ${escHtml(d.agenceAssurance||"—")}</p>
  <p><b>Téléphone :</b> ${escHtml(d.telephoneAssurance||"—")}</p>
  <p><b>Email :</b> ${escHtml(d.emailAssurance||"—")}</p>
</div>

<h2>🔧 Prestation concernée</h2>
<div class="bloc">
  <p><b>Vitrage :</b> ${escHtml(d.vitrage||"—")}</p>
  <p><b>Type de dommage :</b> ${escHtml(d.typeDommage||"—")}</p>
  <p><b>Date sinistre :</b> ${escHtml(d.dateSinistre||"—")}</p>
  <p><b>Lieu sinistre :</b> ${escHtml(d.lieuSinistre||"—")}</p>
  <p><b>Franchise :</b> ${d.franchise==="Oui" ? "Oui — " + (d.montantFranchise||"0") + " €" : (d.franchise==="Non"||!d.franchise) ? "Non — 0 €" : escHtml(d.franchise)}</p>
</div>

<div class="montant">
  <p>Montant de la créance cédée (TTC) :</p>
  <span>${(d.facture||d.devis||"0")} €</span>
  <p style="font-size:11px;margin-top:4px;color:#555;">Montant devis : ${d.devis||"0"} € — Montant facture : ${d.facture||"0"} €</p>
</div>

<div class="legal">
  <p><b>Le cédant déclare et reconnaît :</b></p>
  <p>1. Céder par la présente à titre de paiement, au cessionnaire, l'intégralité de ses droits à indemnisation auprès de son assureur au titre du sinistre bris de glace référencé ci-dessus.</p>
  <p>2. Autoriser expressément son assureur à régler directement et intégralement le cessionnaire, en lieu et place du cédant, pour les travaux de réparation ou remplacement du vitrage endommagé.</p>
  <p>3. Avoir été informé que la présente cession de créances est irrévocable dès signature des deux parties.</p>
  <p>4. Certifier que la créance cédée est certaine, liquide et exigible, et qu'elle n'a fait l'objet d'aucune cession antérieure ni d'aucun nantissement.</p>
</div>

<div class="signatures">
  <div class="sig-box">
    <p><b>Signature du cédant (assuré)</b></p>
    <p style="margin-top:4px;">${escHtml(d.client)}</p>
    <p>Fait à ______________________ le ${dateAuj}</p>
    <div style="margin-top:40px;border-bottom:1px dashed #999;"></div>
    <p style="margin-top:4px;font-style:italic;">Lu et approuvé</p>
    ${d.signatureBase64 ? `<img src="${d.signatureBase64}" style="height:60px;margin-top:8px;">` : ""}
  </div>
  <div class="sig-box">
    <p><b>Signature du cessionnaire (réparateur)</b></p>
    <p style="margin-top:4px;">${escHtml(ent.nom||"")}</p>
    <p>Fait à ______________________ le ${dateAuj}</p>
    <div style="margin-top:40px;border-bottom:1px dashed #999;"></div>
    <p style="margin-top:4px;font-style:italic;">Cachet et signature</p>
  </div>
</div>

</body>
</html>`);
  fenetre.document.close();
  setTimeout(()=>fenetre.print(), 500);
}

/* =====================================
   MISE A JOUR BOUTONS DOSSIER
===================================== */



/* initialiserApplication consolidée plus haut */


/* =====================================
   MÉCANIQUE — DONNÉES
===================================== */

let dossiersMecanique = JSON.parse(localStorage.getItem("dossiersMecanique")) || [];
/* =====================================
   MÉCANIQUE — TARIFS & RÉPARATIONS
===================================== */

const tarifsMecaniqueDefaut = [
  { nom:"Diagnostic", prixHT:45, tva:20 },
  { nom:"Main d'œuvre mécanique", prixHT:65, tva:20 },
  { nom:"Main d'œuvre spécialisée", prixHT:85, tva:20 },
  { nom:"Recherche de panne", prixHT:70, tva:20 }
];
let tarifsMecanique = JSON.parse(localStorage.getItem("tarifsMecanique") || "null") || tarifsMecaniqueDefaut;

function saveTarifsMecanique(){ localStorage.setItem("tarifsMecanique", JSON.stringify(tarifsMecanique)); }
function getProchainNumeroOrdreReparation(){
  let max = 0;
  dossiersMecanique.forEach(d => { const n=parseInt(String(d.ordreReparationNumero||"").replace("OR",""),10); if(!isNaN(n)&&n>max) max=n; });
  return "OR" + String(max + 1).padStart(5,"0");
}
function remplirTarifsMecanique(){
  const sel=document.getElementById("mec_tarifMO"); if(!sel) return;
  const cur=sel.value;
  sel.innerHTML='<option value="">Main d\'œuvre — tarif prédéfini</option>' + tarifsMecanique.map((t,i)=>`<option value="${i}">${escHtml(t.nom)} — ${Number(t.prixHT).toFixed(2)} € HT/h</option>`).join("");
  if(cur!=="") sel.value=cur;
}
function appliquerTarifMecanique(){
  const sel=document.getElementById("mec_tarifMO"), h=document.getElementById("mec_heuresMO"), devis=document.getElementById("mec_devis");
  if(!sel||!h||!devis||sel.value==="") return;
  const tarif=tarifsMecanique[Number(sel.value)]; if(!tarif) return;
  const heures=parseFloat(h.value)||1; if(!h.value) h.value="1";
  const ttc = heures * Number(tarif.prixHT||0) * (1 + Number(tarif.tva||20)/100);
  devis.value = ttc.toFixed(2);
}
function ouvrirGestionTarifsMecanique(){
  ouvrirModal("⚙️ Tarifs main d'œuvre mécanique", `
    <div class="table-wrapper"><table><thead><tr><th>Libellé</th><th>Prix HT / h</th><th>TVA</th><th>Action</th></tr></thead><tbody id="listeTarifsMecaniqueModal">
      ${tarifsMecanique.map((t,i)=>`<tr><td><input id="tm_nom_${i}" value="${String(t.nom||"").replace(/"/g,'&quot;')}"></td><td><input type="number" step="0.01" id="tm_prix_${i}" value="${t.prixHT}"></td><td><input type="number" step="0.01" id="tm_tva_${i}" value="${t.tva||20}"></td><td><button class="delete-btn" onclick="supprimerTarifMecanique(${i});document.querySelector('.modal')?.remove();ouvrirGestionTarifsMecanique();">🗑</button></td></tr>`).join("")}
    </tbody></table></div>
    <h3>➕ Ajouter / échanger un tarif</h3>
    <div class="form-grid"><input id="tm_new_nom" placeholder="Nom du tarif"><input type="number" step="0.01" id="tm_new_prix" placeholder="Prix HT / h"><input type="number" step="0.01" id="tm_new_tva" value="20" placeholder="TVA %"></div>
  `, function(){
    tarifsMecanique = tarifsMecanique.map((t,i)=>({ nom:document.getElementById('tm_nom_'+i)?.value.trim()||t.nom, prixHT:parseFloat(document.getElementById('tm_prix_'+i)?.value)||0, tva:parseFloat(document.getElementById('tm_tva_'+i)?.value)||20 }));
    const nn=document.getElementById('tm_new_nom')?.value.trim(); const np=parseFloat(document.getElementById('tm_new_prix')?.value); const nt=parseFloat(document.getElementById('tm_new_tva')?.value)||20;
    if(nn && !isNaN(np)) tarifsMecanique.push({nom:nn, prixHT:np, tva:nt});
    saveTarifsMecanique(); remplirTarifsMecanique(); toast('Tarifs main d’œuvre enregistrés ✓');
  });
}
function supprimerTarifMecanique(i){ tarifsMecanique.splice(i,1); saveTarifsMecanique(); remplirTarifsMecanique(); }
function formatMecMontant(v){ return v ? Number(v).toLocaleString("fr-FR",{minimumFractionDigits:2})+" €" : "—"; }
function getReparationsMecanique(d){
  if(Array.isArray(d.reparations) && d.reparations.length) return d.reparations;
  return [{ titre:d.typePanne||"Intervention", description:d.description||"", technicien:d.technicien||"", heuresMO:d.heuresMO||"", tarifMO:d.tarifMO||"", montant:d.devis||"" }];
}
function getTotalReparationsMecanique(d){
  return getReparationsMecanique(d).reduce((a,r)=>a+(parseFloat(r.montant)||0),0);
}
function getLignesDocumentMecanique(d, type){
  const prop = type === "facture" ? "lignesFactureMecanique" : "lignesDevisMecanique";
  return Array.isArray(d[prop]) ? d[prop] : [];
}
function getTotalLignesMecanique(d, type){
  return getLignesDocumentMecanique(d, type).reduce((a,l)=>a+(parseFloat(l.totalTTC)||0),0);
}
function getLignesMecaniquePourDocument(d, type){
  const devis = getLignesDocumentMecanique(d, "devis");
  const facture = getLignesDocumentMecanique(d, "facture");
  if(type === "facture"){
    return facture.length ? facture : devis;
  }
  if(type === "ordre"){
    const all = [...devis, ...facture];
    const seen = new Set();
    return all.filter(l => {
      const key = [l.designation||"", l.type||"", l.qte||"", l.prixHT||"", l.tva||"", l.totalTTC||""].join("|");
      if(seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
  return devis;
}
function getTotalLignesMecaniquePourDocument(d, type){
  return getLignesMecaniquePourDocument(d, type).reduce((a,l)=>a+(parseFloat(l.totalTTC)||0),0);
}
function recalculerTotauxMecanique(d){
  const totalReps = getTotalReparationsMecanique(d);
  const totalDevis = totalReps + getTotalLignesMecaniquePourDocument(d, "devis");
  const totalFacture = totalReps + getTotalLignesMecaniquePourDocument(d, "facture");
  if(totalDevis > 0) d.devis = totalDevis.toFixed(2);
  if(totalFacture > 0) d.facture = totalFacture.toFixed(2);
}
function lignesDocumentVersLignesMecanique(){
  return lignesDocument.map(l=>{
    const ht = (parseFloat(l.qte)||0) * (parseFloat(l.prixHT)||0);
    const tva = parseFloat(l.tva)||0;
    const totalTTC = ht * (1 + tva/100);
    return { designation:l.designation||"", type:l.type||"", qte:parseFloat(l.qte)||0, prixHT:parseFloat(l.prixHT)||0, tva, totalHT:ht, totalTTC };
  });
}


/* saveData étendue ci-dessous via la version originale modifiée */

/* =====================================
   MÉCANIQUE — NUMÉROTATION
===================================== */

function getProchainNumeroMecanique(){
  let max = 0;
  dossiersMecanique.forEach(d => {
    const n = parseInt(String(d.numero||"").replace("M",""), 10);
    if(!isNaN(n) && n > max) max = n;
  });
  return "M" + String(max + 1).padStart(4, "0");
}

/* =====================================
   MÉCANIQUE — AJOUTER
===================================== */

function ajouterDossierMecanique(){
  const g = id => { const el=document.getElementById(id); return el ? el.value.trim() : ""; };

  const client      = g("mec_client");
  const telephone   = g("mec_telephone");
  const immat       = g("mec_immat").toUpperCase();
  const vehicule    = g("mec_vehicule");
  const kilometrage = g("mec_kilometrage");
  const typePanne   = g("mec_typePanne");
  const description = g("mec_descriptionPanne");
  const dateEntree  = g("mec_dateEntree");
  const dateSortie  = g("mec_dateSortie");
  const technicien  = g("mec_technicien");
  const devis       = g("mec_devis");
  const facture     = g("mec_facture");
  const statut      = g("mec_statut");
  const observation = g("mec_observation");
  const tarifIdx    = g("mec_tarifMO");
  const heuresMO    = g("mec_heuresMO");
  const tarifMO     = tarifIdx !== "" && tarifsMecanique[Number(tarifIdx)] ? tarifsMecanique[Number(tarifIdx)] : null;

  if(!client){ toast("Client obligatoire", "error"); return; }

  const numero = getProchainNumeroMecanique();

  dossiersMecanique.push({
    numero, ordreReparationNumero:getProchainNumeroOrdreReparation(), client, telephone, immat, vehicule, kilometrage,
    typePanne, description, dateEntree, dateSortie,
    technicien, devis, facture, statut, observation, heuresMO, tarifMO,
    reparations:[{ titre:typePanne||"Intervention", description, technicien, heuresMO, tarifMO, montant:devis, date:new Date().toISOString().split("T")[0] }],
    dateCreation: new Date().toLocaleDateString("fr-FR"),
    createdAt: new Date().toISOString()
  });

  saveData();
  renderDossiersMecanique();
  majCompteursMecanique();

  // Réinitialiser le formulaire
  ["mec_client","mec_telephone","mec_immat","mec_vehicule","mec_kilometrage","mec_kilometrageSortie",
   "mec_typePanne","mec_descriptionPanne","mec_dateEntree","mec_dateSortie",
   "mec_technicien","mec_devis","mec_facture","mec_observation","mec_heuresMO"].forEach(id=>{
    const el = document.getElementById(id); if(el) el.value="";
  });
  const st = document.getElementById("mec_statut"); if(st) st.value="En attente"; const tm=document.getElementById("mec_tarifMO"); if(tm) tm.value="";

  toast("Dossier mécanique créé ✓ — " + numero);
}

/* =====================================
   MÉCANIQUE — COMPTEURS
===================================== */

function majCompteursMecanique(){
  let attente=0, pieces=0, encours=0, termine=0, facture=0;
  dossiersMecanique.forEach(d=>{
    if(d.statut==="En attente")       attente++;
    if(d.statut==="En attente pièces") pieces++;
    if(d.statut==="En cours")         encours++;
    if(d.statut==="Terminé")          termine++;
    if(d.statut==="Facturé")          facture++;
  });
  const set = (id,v) => { const el=document.getElementById(id); if(el) el.textContent=v; };
  set("mecCompteurAttente", attente);
  set("mecCompteurPieces",  pieces);
  set("mecCompteurEncours", encours);
  set("mecCompteurTermine", termine);
  set("mecCompteurFacture", facture);
}

/* =====================================
   MÉCANIQUE — RENDER
===================================== */

function renderDossiersMecanique(liste){
  const table = document.getElementById("listeDossiersMecanique");
  if(!table) return;
  const data = liste || dossiersMecanique;

  if(data.length === 0){
    table.innerHTML = `<tr><td colspan="11" style="text-align:center;color:var(--muted);padding:24px;">Aucun dossier mécanique — créez le premier ci-dessus.</td></tr>`;
    return;
  }

  table.innerHTML = data.map((d, i)=>{
    const realIdx = dossiersMecanique.indexOf(d);
    const badgeCls = mecBadgeClass(d.statut);
    return `
    <tr>
      <td><b>${escHtml(d.numero)}</b><div style="font-size:11px;color:var(--muted);">OR: ${escHtml(d.ordreReparationNumero||"—")}</div></td>
      <td>${escHtml(d.client)}</td>
      <td>
        <div style="font-weight:bold;font-size:13px;">${escHtml(d.vehicule||"—")}</div>
        <div style="color:var(--muted);font-size:12px;">${escHtml(d.immat||"—")}</div>
      </td>
      <td>${escHtml(d.kilometrage||"—")}</td>
      <td>${escHtml(d.typePanne||"—")}</td>
      <td>${escHtml(d.dateEntree||"—")}</td>
      <td>${escHtml(d.technicien||"—")}</td>
      <td>${d.devis ? Number(d.devis).toLocaleString("fr-FR",{minimumFractionDigits:2})+" €" : "—"}</td>
      <td>${d.facture ? Number(d.facture).toLocaleString("fr-FR",{minimumFractionDigits:2})+" €" : "—"}</td>
      <td>
        <select onchange="changerStatutMecanique(${realIdx}, this.value)"
          style="padding:4px 8px;border-radius:6px;background:#1e293b;color:#f1f5f9;border:1px solid #334155;font-size:12px;">
          <option value="En attente"       ${d.statut==="En attente"       ?"selected":""}>⏳ En attente</option>
          <option value="En cours"         ${d.statut==="En cours"         ?"selected":""}>🔧 En cours</option>
          <option value="En attente pièces"${d.statut==="En attente pièces"?"selected":""}>📦 Attente pièces</option>
          <option value="Terminé"          ${d.statut==="Terminé"          ?"selected":""}>✅ Terminé</option>
          <option value="Facturé"          ${d.statut==="Facturé"          ?"selected":""}>🧾 Facturé</option>
        </select>
      </td>
      <td style="white-space:nowrap;">
        <button onclick="ouvrirDossierMecanique(${realIdx})" style="background:#7c3aed;">📋 O.R.</button>
        <button onclick="modifierDossierMecanique(${realIdx})">✏ Modifier</button>
        <button onclick="envoyerSmsVehiculeTermine(${realIdx})" style="background:#0891b2;" title="SMS véhicule prêt">📱</button>
        <button class="delete-btn" onclick="supprimerDossierMecanique(${realIdx})">🗑</button>
      </td>
    </tr>`;
  }).join("");
}

function mecBadgeClass(statut){
  if(statut==="Terminé"||statut==="Facturé") return "success";
  if(statut==="En cours") return "warning";
  if(statut==="En attente pièces") return "info";
  return "danger";
}

/* =====================================
   MÉCANIQUE — RECHERCHE
===================================== */

function rechercherMecanique(){
  const q = (document.getElementById("mec_recherche")?.value||"").toLowerCase();
  const statut = document.getElementById("mec_filtreStatut")?.value||"";
  const result = dossiersMecanique.filter(d=>{
    const texte = `${d.numero} ${d.client} ${d.immat} ${d.vehicule} ${d.typePanne} ${d.technicien}`.toLowerCase();
    const okQ = !q || texte.includes(q);
    const okS = !statut || d.statut===statut;
    return okQ && okS;
  });
  renderDossiersMecanique(result);
}

/* =====================================
   MÉCANIQUE — CHANGER STATUT
===================================== */

function changerStatutMecanique(index, statut){
  if(!dossiersMecanique[index]) return;
  dossiersMecanique[index].statut = statut;
  saveData();
  majCompteursMecanique();
  toast("Statut mis à jour : " + statut);
}

/* =====================================
   MÉCANIQUE — SUPPRIMER
===================================== */

function supprimerDossierMecanique(index){
  confirmerAction("Supprimer définitivement ce dossier mécanique ?", ()=>{
    dossiersMecanique.splice(index, 1);
    saveData();
    renderDossiersMecanique();
    majCompteursMecanique();
    toast("Dossier supprimé");
  });
}

/* =====================================
   MÉCANIQUE — MODIFIER
===================================== */

function modifierDossierMecanique(index){
  const d = dossiersMecanique[index];
  const esc = x => (x||"").replace(/"/g,"&quot;");
  ouvrirModal("✏️ Modifier dossier mécanique " + d.numero, `
    <div class="form-grid">
      <input type="text" id="mm_client"    value="${esc(d.client)}"    placeholder="Client">
      <input type="text" id="mm_telephone" value="${esc(d.telephone||"")}" placeholder="Téléphone">
      <input type="text" id="mm_immat"     value="${esc(d.immat||"")}" placeholder="Immatriculation">
      <input type="text" id="mm_vehicule"  value="${esc(d.vehicule||"")}" placeholder="Marque / Modèle">
      <input type="text" id="mm_km"        value="${esc(d.kilometrage||"")}" placeholder="Kilométrage">
      <input type="text" id="mm_type"      value="${esc(d.typePanne||"")}" placeholder="Type d'intervention">
      <input type="text" id="mm_desc"      value="${esc(d.description||"")}" placeholder="Description panne">
      <input type="date" id="mm_entree"    value="${esc(d.dateEntree||"")}">
      <input type="date" id="mm_sortie"    value="${esc(d.dateSortie||"")}">
      <input type="text" id="mm_tech"      value="${esc(d.technicien||"")}" placeholder="Technicien">
      <input type="number" id="mm_devis"   value="${esc(d.devis||"")}" placeholder="Devis (€)" step="0.01">
      <input type="number" id="mm_facture" value="${esc(d.facture||"")}" placeholder="Facture (€)" step="0.01">
      <select id="mm_statut">
        <option value="En attente"        ${d.statut==="En attente"       ?"selected":""}>⏳ En attente</option>
        <option value="En cours"          ${d.statut==="En cours"         ?"selected":""}>🔧 En cours</option>
        <option value="En attente pièces" ${d.statut==="En attente pièces"?"selected":""}>📦 Attente pièces</option>
        <option value="Terminé"           ${d.statut==="Terminé"          ?"selected":""}>✅ Terminé</option>
        <option value="Facturé"           ${d.statut==="Facturé"          ?"selected":""}>🧾 Facturé</option>
      </select>
      <textarea id="mm_obs" placeholder="Observations" style="grid-column:1/-1;height:70px;">${esc(d.observation||"")}</textarea>
    </div>`,
    function(){
      const get = id => document.getElementById(id)?.value.trim()||"";
      if(!get("mm_client")){ toast("Client obligatoire","error"); return false; }
      dossiersMecanique[index] = {
        ...d,
        client:      get("mm_client"),
        telephone:   get("mm_telephone"),
        immat:       get("mm_immat").toUpperCase(),
        vehicule:    get("mm_vehicule"),
        kilometrage: get("mm_km"),
        typePanne:   get("mm_type"),
        description: get("mm_desc"),
        dateEntree:  get("mm_entree"),
        dateSortie:  get("mm_sortie"),
        technicien:  get("mm_tech"),
        devis:       get("mm_devis"),
        facture:     get("mm_facture"),
        statut:      get("mm_statut"),
        observation: get("mm_obs"),
        modifiedAt: new Date().toISOString(),
        modifiedBy: getSessionUtilisateur()?.nom||"—"
      };
      saveData(); renderDossiersMecanique(); majCompteursMecanique(); toast("Dossier modifié ✓");
    }
  );
}

/* =====================================
   MÉCANIQUE — FICHE DÉTAIL
===================================== */

function ouvrirDossierMecanique(index){
  const d = dossiersMecanique[index];
  const zone = document.getElementById("detailMecanique");
  if(!zone||!d) return;

  const badgeCls = mecBadgeClass(d.statut);

  zone.innerHTML = `
    <div class="card" style="margin-top:24px;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px;">
        <h2 style="color:#38bdf8;">🔩 Dossier ${escHtml(d.numero)}<br><small style="font-size:13px;color:var(--muted);">Ordre de réparation : ${escHtml(d.ordreReparationNumero||"—")}</small></h2>
        <span class="badge badge-${badgeCls}">${escHtml(d.statut)}</span>
      </div>

      <h3>👤 Client</h3>
      <p><b>${escHtml(d.client)}</b> — ${escHtml(d.telephone||"—")}</p>

      <h3>🚗 Véhicule</h3>
      <p>${escHtml(d.vehicule||"—")} — Immat : <b>${escHtml(d.immat||"—")}</b></p>
      <p>Kilométrage : ${escHtml(d.kilometrage||"—")}</p>

      <h3>🔧 Intervention</h3>
      <p><b>Type :</b> ${escHtml(d.typePanne||"—")}</p>
      <p><b>Description :</b> ${escHtml(d.description||"—")}</p>
      <p><b>Technicien :</b> ${escHtml(d.technicien||"—")}</p>

      <h3>📅 Dates</h3>
      <p><b>Entrée :</b> ${escHtml(d.dateEntree||"—")}</p>
      <p><b>Sortie prévue :</b> ${escHtml(d.dateSortie||"—")}</p>
      <p><b>Créé le :</b> ${escHtml(d.dateCreation||"—")}</p>

      <h3>💶 Montants</h3>
      <p><b>Devis :</b> ${d.devis ? Number(d.devis).toLocaleString("fr-FR",{minimumFractionDigits:2})+" €" : "—"}</p>
      <p><b>Facture :</b> ${d.facture ? Number(d.facture).toLocaleString("fr-FR",{minimumFractionDigits:2})+" €" : "—"}</p>

      ${renderReparationsMecaniqueHtml(d)}

      ${d.observation ? `<h3>📝 Observations</h3><p style="white-space:pre-line;">${escHtml(d.observation)}</p>` : ""}

      <div style="margin-top:20px;display:flex;gap:10px;flex-wrap:wrap;">
        <button onclick="modifierDossierMecanique(${index})">✏ Modifier</button>
        <button onclick="ajouterReparationOrdre(${index})" class="btn-success">➕ Réparation</button>
        <button onclick="imprimerOrdreMission(${index})" style="background:#7c3aed;">🖨 Ordre réparation</button>
        <button onclick="imprimerDocumentMecanique(${index}, 'devis')" style="background:#0891b2;">🖨 Devis</button>
        <button onclick="imprimerDocumentMecanique(${index}, 'facture')" style="background:#0f766e;">🖨 Facture</button>
        <button onclick="envoyerSmsVehiculeTermine(${index})" style="background:#0891b2;">📱 SMS véhicule prêt</button>
        <button onclick="document.getElementById('detailMecanique').innerHTML=''" style="background:#334155;">✖ Fermer</button>
        <button class="delete-btn" onclick="supprimerDossierMecanique(${index})">🗑 Supprimer</button>
      </div>
    </div>`;

  zone.scrollIntoView({behavior:"smooth", block:"start"});
}

/* =====================================
   MÉCANIQUE — ORDRE DE MISSION (PRINT)
===================================== */


function renderReparationsMecaniqueHtml(d){
  const reps = getReparationsMecanique(d);
  return `<h3>🧾 Réparations sur l'ordre</h3><div class="table-wrapper"><table><thead><tr><th>#</th><th>Réparation</th><th>MO</th><th>Montant</th></tr></thead><tbody>${reps.map((r,i)=>`<tr><td>${i+1}</td><td><b>${escHtml(r.titre||"Réparation")}</b><br><span style="color:var(--muted);font-size:12px;white-space:pre-line;">${escHtml(r.description||"")}</span></td><td>${escHtml(r.heuresMO||"—")} h ${r.tarifMO?`<br><small>${escHtml(r.tarifMO.nom||"")}</small>`:""}</td><td>${formatMecMontant(r.montant)}</td></tr>`).join("")}</tbody></table></div>`;
}
function ajouterReparationOrdre(index){
  const d=dossiersMecanique[index]; if(!d) return;
  const opts=tarifsMecanique.map((t,i)=>`<option value="${i}">${escHtml(t.nom)} — ${Number(t.prixHT).toFixed(2)} € HT/h</option>`).join("");
  ouvrirModal("➕ Ajouter une réparation — "+(d.ordreReparationNumero||d.numero), `
    <div class="form-grid"><input id="ar_titre" placeholder="Titre réparation"><textarea id="ar_desc" placeholder="Détail réparation / pièces" style="grid-column:1/-1;height:90px;"></textarea><select id="ar_tarif"><option value="">Tarif main d'œuvre</option>${opts}</select><input type="number" id="ar_heures" step="0.25" placeholder="Heures MO"><input type="number" id="ar_montant" step="0.01" placeholder="Montant TTC (€)"><input id="ar_tech" placeholder="Technicien" value="${String(d.technicien||"").replace(/"/g,'&quot;')}"></div>
  `, function(){
    const get=id=>document.getElementById(id)?.value.trim()||"";
    const ti=get('ar_titre'); if(!ti){ toast('Titre réparation obligatoire','error'); return false; }
    const tarifIdx=get('ar_tarif'); const tarif=tarifIdx!==""?tarifsMecanique[Number(tarifIdx)]:null;
    if(!Array.isArray(d.reparations)) d.reparations=getReparationsMecanique(d);
    d.reparations.push({ titre:ti, description:get('ar_desc'), tarifMO:tarif, heuresMO:get('ar_heures'), montant:get('ar_montant'), technicien:get('ar_tech'), date:new Date().toISOString().split('T')[0] });
    recalculerTotauxMecanique(d);
    saveData(); renderDossiersMecanique(); ouvrirDossierMecanique(index); toast('Réparation ajoutée à l’ordre ✓');
  });
}
function imprimerDocumentMecanique(index, type){
  const d=dossiersMecanique[index]; if(!d){ toast('Dossier introuvable','error'); return; }
  recalculerTotauxMecanique(d);
  const reps=getReparationsMecanique(d); const ent=entreprise||{};
  const lignes = getLignesMecaniquePourDocument(d, type);
  const totalReps = getTotalReparationsMecanique(d);
  const totalLignes = getTotalLignesMecaniquePourDocument(d, type);
  const total = totalReps + totalLignes || parseFloat(type==='facture'?d.facture:d.devis)||0;
  const rowsReps = reps.map(r=>`<tr><td><b>${escHtml(r.titre||'Réparation')}</b><br>${escHtml(r.description||'')}</td><td>Main d'œuvre</td><td>${escHtml(r.heuresMO||'—')} h ${r.tarifMO?escHtml(r.tarifMO.nom||''):''}</td><td>${formatMecMontant(r.montant)}</td></tr>`).join('');
  const rowsLignes = lignes.map(l=>`<tr><td><b>${escHtml(l.designation||'Pièce / Produit')}</b></td><td>${escHtml(l.type||'Produit')}</td><td>${Number(l.qte||0).toLocaleString('fr-FR')} × ${Number(l.prixHT||0).toLocaleString('fr-FR',{minimumFractionDigits:2})} € HT<br><small>TVA ${Number(l.tva||0)}%</small></td><td>${formatMecMontant(l.totalTTC)}</td></tr>`).join('');
  const f=window.open('', '_blank', 'width=800,height=900');
  f.document.write(`<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>${type==='facture'?'Facture':'Devis'} ${d.numero}</title><style>body{font-family:Arial,sans-serif;padding:32px;color:#111}h1{text-align:center}.head{display:flex;justify-content:space-between}.bloc{border:1px solid #ddd;border-radius:8px;padding:12px;margin:12px 0}table{width:100%;border-collapse:collapse;margin-top:18px}th,td{border-bottom:1px solid #ddd;padding:8px;text-align:left;vertical-align:top}th{background:#1e293b;color:white}.total{text-align:right;font-size:18px;font-weight:bold;margin-top:20px}.sous-total{text-align:right;font-size:13px;margin-top:8px;color:#333}@media print{body{padding:12px}}</style></head><body><div class="head"><div><b>${escHtml(ent.nom||'')}</b><br>${escHtml(ent.adresse||'')}<br>${escHtml(ent.telephone||'')} ${escHtml(ent.email||'')}<br>SIRET : ${escHtml(ent.siret||'')}</div><div><b>Dossier :</b> ${escHtml(d.numero)}<br><b>OR :</b> ${escHtml(d.ordreReparationNumero||'—')}<br><b>Date :</b> ${new Date().toLocaleDateString('fr-FR')}</div></div><h1>${type==='facture'?'FACTURE':'DEVIS'} MÉCANIQUE</h1><div class="bloc"><b>Client :</b> ${escHtml(d.client)} — ${escHtml(d.telephone||'—')}<br><b>Véhicule :</b> ${escHtml(d.vehicule||'—')} — ${escHtml(d.immat||'—')} — Km : ${escHtml(d.kilometrage||'—')}</div><table><thead><tr><th>Désignation</th><th>Type</th><th>Détail</th><th>Montant TTC</th></tr></thead><tbody>${rowsReps}${rowsLignes}</tbody></table><div class="sous-total">Main d'œuvre / réparations : ${formatMecMontant(totalReps)}</div><div class="sous-total">Pièces / lignes ajoutées : ${formatMecMontant(totalLignes)}</div><div class="total">Total TTC : ${formatMecMontant(total)}</div><script>setTimeout(()=>print(),300)<\/script></body></html>`);
  f.document.close();
}

function imprimerOrdreMission(index){
  const d = dossiersMecanique[index];
  if(!d){ toast("Dossier introuvable", "error"); return; }
  recalculerTotauxMecanique(d);
  const ent = entreprise || {};
  const dateAuj = new Date().toLocaleDateString("fr-FR");

  const fenetre = window.open("","_blank","width=800,height=900");
  fenetre.document.write(`<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8">
  <title>Ordre de mission — ${d.numero}</title>
  <style>
    body{font-family:Arial,sans-serif;font-size:13px;color:#111;padding:32px;max-width:720px;margin:0 auto;}
    h1{font-size:20px;border-bottom:2px solid #333;padding-bottom:8px;margin-bottom:16px;}
    h2{font-size:15px;margin-top:20px;margin-bottom:6px;color:#1a3a6a;}
    p{margin:4px 0;line-height:1.5;}
    .bloc{background:#f7f8fa;border:1px solid #ddd;border-radius:8px;padding:12px 16px;margin-bottom:12px;}
    .montant{font-size:16px;font-weight:bold;background:#1a3a6a;color:#fff;padding:12px 16px;border-radius:8px;margin:16px 0;}
    .sig{display:flex;gap:40px;margin-top:32px;}
    .sig-box{flex:1;border:1px dashed #999;border-radius:8px;padding:16px;min-height:100px;}
    @media print{body{padding:12px;}}
  </style></head><body>
  <h1>🔩 Ordre de réparation mécanique — ${d.ordreReparationNumero||d.numero}</h1>

  <div class="bloc">
    <h2>Entreprise</h2>
    <p><b>${escHtml(ent.nom||"—")}</b></p>
    <p>${escHtml(ent.adresse||"")}</p>
    <p>Tél : ${escHtml(ent.telephone||"")} — Email : ${escHtml(ent.email||"")}</p>
    <p>SIRET : ${escHtml(ent.siret||"")}</p>
  </div>

  <div class="bloc">
    <h2>Client</h2>
    <p><b>${escHtml(d.client)}</b> — ${escHtml(d.telephone||"—")}</p>
  </div>

  <div class="bloc">
    <h2>Véhicule</h2>
    <p><b>${escHtml(d.vehicule||"—")}</b> — Immat : <b>${escHtml(d.immat||"—")}</b></p>
    <p>Kilométrage entrée : ${escHtml(d.kilometrage||"—")}</p>
  </div>

  <div class="bloc">
    <h2>Intervention</h2>
    <table style="width:100%;border-collapse:collapse;"><thead><tr><th style="text-align:left;border-bottom:1px solid #ccc;padding:6px;">Désignation</th><th style="text-align:left;border-bottom:1px solid #ccc;padding:6px;">Type / détail</th><th style="text-align:left;border-bottom:1px solid #ccc;padding:6px;">Montant</th></tr></thead><tbody>${getReparationsMecanique(d).map(r=>`<tr><td style="border-bottom:1px solid #eee;padding:6px;"><b>${escHtml(r.titre||"Réparation")}</b><br>${escHtml(r.description||"")}</td><td style="border-bottom:1px solid #eee;padding:6px;">Main d'œuvre<br>${escHtml(r.heuresMO||"—")} h ${r.tarifMO?escHtml(r.tarifMO.nom||""):""}</td><td style="border-bottom:1px solid #eee;padding:6px;">${formatMecMontant(r.montant)}</td></tr>`).join("")}${getLignesMecaniquePourDocument(d,"ordre").map(l=>`<tr><td style="border-bottom:1px solid #eee;padding:6px;"><b>${escHtml(l.designation||"Pièce / Produit")}</b></td><td style="border-bottom:1px solid #eee;padding:6px;">${escHtml(l.type||"Produit")}<br>${Number(l.qte||0).toLocaleString('fr-FR')} × ${Number(l.prixHT||0).toLocaleString('fr-FR',{minimumFractionDigits:2})} € HT — TVA ${Number(l.tva||0)}%</td><td style="border-bottom:1px solid #eee;padding:6px;">${formatMecMontant(l.totalTTC)}</td></tr>`).join("")}</tbody></table>
    <p><b>Technicien :</b> ${escHtml(d.technicien||"—")}</p>
    <p><b>Date entrée :</b> ${escHtml(d.dateEntree||"—")} — <b>Date sortie prévue :</b> ${escHtml(d.dateSortie||"—")}</p>
    ${d.observation ? `<p><b>Observations :</b> ${escHtml(d.observation)}</p>` : ""}
  </div>

  <div class="montant">Montant devis : ${d.devis ? Number(d.devis).toLocaleString("fr-FR",{minimumFractionDigits:2})+" €" : "—"}
  &nbsp;&nbsp;|&nbsp;&nbsp; Montant facture : ${d.facture ? Number(d.facture).toLocaleString("fr-FR",{minimumFractionDigits:2})+" €" : "—"}</div>

  <div class="sig">
    <div class="sig-box">
      <p><b>Signature du client</b></p>
      <p>${escHtml(d.client)} — le ${dateAuj}</p>
      <div style="margin-top:50px;border-bottom:1px dashed #999;"></div>
      <p style="font-style:italic;font-size:11px;">Lu et approuvé</p>
    </div>
    <div class="sig-box">
      <p><b>Visa technicien</b></p>
      <p>${escHtml(d.technicien||"")} — le ${dateAuj}</p>
      <div style="margin-top:50px;border-bottom:1px dashed #999;"></div>
      <p style="font-style:italic;font-size:11px;">Signature</p>
    </div>
  </div>
  </body></html>`);
  fenetre.document.close();
  setTimeout(()=>fenetre.print(), 400);
}

/* =====================================
   MÉCANIQUE — INIT AU CHARGEMENT
===================================== */

/* showPage étendue dans la version originale ci-dessus */

/* =====================================
   SMS — VÉHICULE PRÊT
===================================== */

function envoyerSmsVehiculeTermine(index){
  const d = dossiersMecanique[index];
  if(!d){ toast("Dossier introuvable", "error"); return; }

  const ent = entreprise || {};
  const nomEntreprise = ent.nom || "DA-Gestion";
  const telEntreprise = ent.telephone || "";

  // Message SMS par défaut
  const msgDefaut = `Bonjour ${d.client},\nVotre véhicule ${d.vehicule||""}${d.immat?" ("+d.immat+")":""} est prêt et disponible à récupérer.\n${telEntreprise ? "📞 "+telEntreprise : ""}\n${nomEntreprise}`;

  ouvrirModal("📱 Envoyer un SMS — Véhicule prêt", `
    <div style="display:flex;flex-direction:column;gap:12px;">
      <div>
        <label style="font-size:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:5px;">Destinataire</label>
        <input type="text" id="sms_nom" value="${(d.client||"").replace(/"/g,'&quot;')}" placeholder="Nom du client" style="width:100%;">
      </div>
      <div>
        <label style="font-size:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:5px;">📞 Numéro de téléphone</label>
        <input type="tel" id="sms_tel" value="${(d.telephone||"").replace(/"/g,'&quot;')}" placeholder="06 xx xx xx xx" style="width:100%;">
      </div>
      <div>
        <label style="font-size:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:5px;">💬 Message</label>
        <textarea id="sms_message" rows="6" style="width:100%;resize:vertical;">${msgDefaut.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</textarea>
        <div id="sms_compteur" style="text-align:right;font-size:11px;color:#64748b;margin-top:4px;">0 caractères</div>
      </div>
      <div style="background:#0f172a;border:1px solid #1e293b;border-radius:8px;padding:12px;font-size:12px;color:#64748b;">
        💡 <b>Comment envoyer :</b> Cliquez "Envoyer" pour ouvrir votre application SMS avec le message pré-rempli. Sur mobile, le message s'ouvrira directement dans votre messagerie.
      </div>
    </div>
    <script>
      (function(){
        const ta = document.getElementById("sms_message");
        const cpt = document.getElementById("sms_compteur");
        if(ta && cpt){
          const upd = () => { cpt.textContent = ta.value.length + " caractères" + (ta.value.length > 160 ? " (⚠️ " + Math.ceil(ta.value.length/160) + " SMS)" : " (1 SMS)"); };
          ta.addEventListener("input", upd);
          upd();
        }
      })();
    <\/script>`,
    function(){
      const tel     = document.getElementById("sms_tel")?.value.trim().replace(/\s/g,"");
      const message = document.getElementById("sms_message")?.value.trim();
      if(!tel){ toast("Numéro de téléphone obligatoire", "error"); return false; }
      if(!message){ toast("Message vide", "error"); return false; }

      // Encoder pour URI
      const msgEncode = encodeURIComponent(message);
      const telEncode = tel.replace(/^0/, "+33");

      // Ouvrir l'app SMS native via sms: URI
      const lien = document.createElement("a");
      lien.href = `sms:${telEncode}?body=${msgEncode}`;
      lien.style.display = "none";
      document.body.appendChild(lien);
      lien.click();
      setTimeout(() => lien.remove(), 500);

      // Marquer le dossier comme SMS envoyé
      dossiersMecanique[index].smsPretEnvoye = new Date().toISOString();
      saveData();
      toast("📱 SMS ouvert — " + d.client);
    }
  );

  // Changer le label du bouton OK
  setTimeout(()=>{
    const btn = document.getElementById("modalBtnOk");
    if(btn){ btn.textContent = "📱 Envoyer le SMS"; btn.style.background = "#0891b2"; }
  }, 50);
}

/* =====================================
   PATCH DASHBOARD SÉPARÉ VITRAGE / MÉCANIQUE
   Conservé : formulaire mécanique avec Main d'œuvre + tarif horaire
===================================== */
(function(){
  function setTxt(id, val){ const el=document.getElementById(id); if(el) el.textContent = val; }
  function euro(val){ return Number(val||0).toLocaleString('fr-FR') + ' €'; }
  function statutCount(liste, statut){ return (liste||[]).filter(d => d && d.statut === statut).length; }
  function caVitrage(){ return (Array.isArray(dossiers)?dossiers:[]).reduce((s,d)=> s + Number(d.facture || d.devis || 0), 0); }
  function caMecanique(){
    const lm = (typeof dossiersMecanique !== 'undefined' && Array.isArray(dossiersMecanique)) ? dossiersMecanique : [];
    return lm.reduce((s,d)=>{
      if(typeof recalculerTotauxMecanique === 'function') recalculerTotauxMecanique(d);
      return s + Number(d.facture || d.devis || 0);
    },0);
  }

  const _ancienMajDashboard = typeof majDashboard === 'function' ? majDashboard : null;
  window.majDashboard = majDashboard = function(){
    const vit = Array.isArray(dossiers) ? dossiers : [];
    const mec = (typeof dossiersMecanique !== 'undefined' && Array.isArray(dossiersMecanique)) ? dossiersMecanique : [];
    const caVit = caVitrage();
    const caMec = caMecanique();

    setTxt('dashVitrageTotal', vit.length);
    setTxt('dashVitrageAttente', statutCount(vit,'En attente'));
    setTxt('dashVitrageEncours', statutCount(vit,'En cours'));
    setTxt('dashVitrageTermine', statutCount(vit,'Terminé'));
    setTxt('dashVitrageFacture', statutCount(vit,'Facturé'));
    setTxt('dashVitrageCA', euro(caVit));

    setTxt('dashMecaTotal', mec.length);
    setTxt('dashMecaOR', mec.filter(d => d && d.ordreReparationNumero).length);
    setTxt('dashMecaAttente', statutCount(mec,'En attente'));
    setTxt('dashMecaPieces', statutCount(mec,'Attente pièces'));
    setTxt('dashMecaEncours', statutCount(mec,'En cours'));
    setTxt('dashMecaTermine', statutCount(mec,'Terminé'));
    setTxt('dashMecaFacture', statutCount(mec,'Facturé'));
    setTxt('dashMecaCA', euro(caMec));

    setTxt('totalDossiers', vit.length + mec.length);
    setTxt('totalClients', Array.isArray(clients) ? clients.length : 0);
    setTxt('totalVehicules', Array.isArray(vehicules) ? vehicules.length : 0);
    setTxt('dashGlobalVitrage', vit.length);
    setTxt('dashGlobalMeca', mec.length);
    setTxt('caMois', euro(caVit + caMec));

    majCompteursDossiers();
    if(typeof renderStatistiques === 'function') renderStatistiques();
    if(typeof renderGraphiqueMensuel === 'function') renderGraphiqueMensuel();
    if(typeof renderGraphiqueMensuelMecanique === 'function') renderGraphiqueMensuelMecanique();
  };

  window.majCompteursDossiers = majCompteursDossiers = function(){
    const tous = [ ...(Array.isArray(dossiers)?dossiers:[]), ...((typeof dossiersMecanique !== 'undefined' && Array.isArray(dossiersMecanique)) ? dossiersMecanique : []) ];
    setTxt('compteurAttente', tous.filter(d=>d.statut==='En attente').length);
    setTxt('compteurEncours', tous.filter(d=>d.statut==='En cours').length);
    setTxt('compteurTermine', tous.filter(d=>d.statut==='Terminé').length);
    setTxt('compteurFacture', tous.filter(d=>d.statut==='Facturé').length);
  };

  function _renderGraphiqueListe(canvasId, liste){
    const canvas=document.getElementById(canvasId); if(!canvas) return;
    const ctx=canvas.getContext('2d');
    const maintenant=new Date();
    const mois=[];
    for(let i=5;i>=0;i--){ const d=new Date(maintenant.getFullYear(), maintenant.getMonth()-i, 1); mois.push({label:d.toLocaleDateString('fr-FR',{month:'short',year:'2-digit'}), annee:d.getFullYear(), mois:d.getMonth()}); }
    const comptages=mois.map(m => (liste||[]).filter(d=>{ const dt=new Date(d.dateCreation||d.date||d.dateEntree||''); return dt.getFullYear()===m.annee && dt.getMonth()===m.mois; }).length);
    const maxVal=Math.max(...comptages,1), w=canvas.width, h=canvas.height;
    const pad={top:20,right:20,bottom:40,left:40};
    const barW=Math.floor((w-pad.left-pad.right)/mois.length*0.5);
    const barGap=Math.floor((w-pad.left-pad.right)/mois.length);
    ctx.clearRect(0,0,w,h);
    ctx.strokeStyle='#1e293b'; ctx.lineWidth=1;
    for(let i=0;i<=4;i++){ const y=pad.top+(h-pad.top-pad.bottom)/4*i; ctx.beginPath(); ctx.moveTo(pad.left,y); ctx.lineTo(w-pad.right,y); ctx.stroke(); }
    mois.forEach((m,i)=>{ const x=pad.left+i*barGap+barGap/2-barW/2; const barH=((h-pad.top-pad.bottom)*(comptages[i]/maxVal)); const y=h-pad.bottom-barH; const grad=ctx.createLinearGradient(x,y,x,h-pad.bottom); grad.addColorStop(0,'#38bdf8'); grad.addColorStop(1,'#2563eb44'); ctx.fillStyle=grad; ctx.beginPath(); if(ctx.roundRect) ctx.roundRect(x,y,barW,barH,4); else ctx.rect(x,y,barW,barH); ctx.fill(); if(comptages[i]>0){ ctx.fillStyle='#f1f5f9'; ctx.font='bold 11px sans-serif'; ctx.textAlign='center'; ctx.fillText(comptages[i], x+barW/2, y-5); } ctx.fillStyle='#64748b'; ctx.font='11px sans-serif'; ctx.textAlign='center'; ctx.fillText(m.label, x+barW/2, h-pad.bottom+16); });
  }

  window.renderGraphiqueMensuel = renderGraphiqueMensuel = function(){ _renderGraphiqueListe('graphiqueMensuel', Array.isArray(dossiers)?dossiers:[]); };
  window.renderGraphiqueMensuelMecanique = renderGraphiqueMensuelMecanique = function(){ _renderGraphiqueListe('graphiqueMensuelMecanique', (typeof dossiersMecanique !== 'undefined' && Array.isArray(dossiersMecanique)) ? dossiersMecanique : []); };
})();

/* =====================================================
   ████  NOUVELLES FONCTIONNALITÉS  ████
   1. Dashboard CA mensuel + top clients + alertes
   2. Vitrage : prise en charge assurance
   3. Clients : fiche complète avec historique
   4. Mécanique : alertes retard + historique véhicule
   5. Calendrier mensuel agenda
   6. Export Excel global
   7. Mode clair/sombre
   8. Firebase auto-save
===================================================== */

/* ─────────────────────────────────────────────────
   1. DASHBOARD — CA MENSUEL (Vitrage vs Mécanique)
───────────────────────────────────────────────────*/

function majDashboardVitrageMeca(){
  const mecs = typeof dossiersMecanique !== "undefined" ? dossiersMecanique : [];
  let vCA=0, mCA=0, vAtt=0, vEnc=0, vTerm=0, vFact=0;
  let mAtt=0, mPieces=0, mEnc=0, mTerm=0, mFact=0, mOR=0;
  dossiers.forEach(d=>{
    vCA += Number(d.facture||0);
    if(d.statut==="En attente") vAtt++;
    if(d.statut==="En cours") vEnc++;
    if(d.statut==="Terminé") vTerm++;
    if(d.statut==="Facturé") vFact++;
  });
  mecs.forEach(d=>{
    mCA += Number(d.facture||d.devis||0);
    if(d.statut==="En attente") mAtt++;
    if(d.statut==="En attente pièces") mPieces++;
    if(d.statut==="En cours") mEnc++;
    if(d.statut==="Terminé") mTerm++;
    if(d.statut==="Facturé") mFact++;
    if(d.ordreReparationNumero) mOR++;
  });
  const fmt = v => v.toLocaleString("fr-FR",{minimumFractionDigits:2})+" €";
  const set = (id,v) => { const el=document.getElementById(id); if(el) el.textContent=v; };
  set("dashVitrageTotal", dossiers.length);
  set("dashVitrageCA",    fmt(vCA));
  set("dashVitrageAttente", vAtt); set("dashVitrageEncours", vEnc);
  set("dashVitrageTermine", vTerm); set("dashVitrageFacture", vFact);
  set("dashMecaTotal",    mecs.length);
  set("dashMecaCA",       fmt(mCA));
  set("dashMecaOR",       mOR); set("dashMecaAttente", mAtt);
  set("dashMecaPieces",   mPieces); set("dashMecaEncours", mEnc);
  set("dashMecaTermine",  mTerm); set("dashMecaFacture", mFact);
  set("dashGlobalVitrage", dossiers.length);
  set("dashGlobalMeca",    mecs.length);
}

function renderGraphiqueCAMensuel(){
  const canvas = document.getElementById("graphiqueCAMensuel");
  if(!canvas) return;
  const ctx = canvas.getContext("2d");
  const mecs = typeof dossiersMecanique !== "undefined" ? dossiersMecanique : [];
  const maintenant = new Date();
  const mois = [];
  for(let i=5; i>=0; i--){
    const d = new Date(maintenant.getFullYear(), maintenant.getMonth()-i, 1);
    mois.push({ label: d.toLocaleDateString("fr-FR",{month:"short",year:"2-digit"}), annee:d.getFullYear(), mois:d.getMonth() });
  }
  const caVitrage  = mois.map(m => dossiers.filter(d=>{ const dt=new Date(d.dateCreation||d.date||""); return dt.getFullYear()===m.annee&&dt.getMonth()===m.mois; }).reduce((a,d)=>a+Number(d.facture||0),0));
  const caMeca     = mois.map(m => mecs.filter(d=>{ const dt=new Date(d.dateCreation||d.createdAt||""); return dt.getFullYear()===m.annee&&dt.getMonth()===m.mois; }).reduce((a,d)=>a+Number(d.facture||d.devis||0),0));
  const maxCA = Math.max(...caVitrage, ...caMeca, 1);
  const w=canvas.width, h=canvas.height;
  const pad={top:24,right:20,bottom:44,left:60};
  const n=mois.length;
  const totalW = w-pad.left-pad.right;
  const groupW = totalW/n;
  const barW = Math.floor(groupW*0.3);
  ctx.clearRect(0,0,w,h);
  // Grid lines
  for(let g=0;g<=4;g++){
    const y = pad.top + (h-pad.top-pad.bottom)*(1-g/4);
    ctx.strokeStyle="#1e293b"; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(pad.left,y); ctx.lineTo(w-pad.right,y); ctx.stroke();
    ctx.fillStyle="#64748b"; ctx.font="10px sans-serif"; ctx.textAlign="right";
    ctx.fillText((maxCA*g/4).toLocaleString("fr-FR",{maximumFractionDigits:0})+"€", pad.left-4, y+4);
  }
  mois.forEach((m,i)=>{
    const x0 = pad.left + i*groupW + groupW/2;
    const drawBar = (val, color, offset) => {
      const barH = Math.max(2, (val/maxCA)*(h-pad.top-pad.bottom));
      const x = x0 + offset;
      const y = h-pad.bottom-barH;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(x,y,barW,barH,3) : ctx.rect(x,y,barW,barH);
      ctx.fill();
      if(val>0){ ctx.fillStyle="#f1f5f9"; ctx.font="bold 9px sans-serif"; ctx.textAlign="center"; ctx.fillText(val.toLocaleString("fr-FR",{maximumFractionDigits:0}), x+barW/2, y-4); }
    };
    drawBar(caVitrage[i], "#2563eb", -barW-2);
    drawBar(caMeca[i],    "#16a34a",  2);
    ctx.fillStyle="#94a3b8"; ctx.font="11px sans-serif"; ctx.textAlign="center";
    ctx.fillText(m.label, x0, h-pad.bottom+16);
  });
  // Légende
  const ly = h-6;
  ctx.fillStyle="#2563eb"; ctx.fillRect(pad.left, ly-8, 12, 8);
  ctx.fillStyle="#94a3b8"; ctx.font="11px sans-serif"; ctx.textAlign="left";
  ctx.fillText("Vitrage", pad.left+16, ly);
  ctx.fillStyle="#16a34a"; ctx.fillRect(pad.left+80, ly-8, 12, 8);
  ctx.fillStyle="#94a3b8"; ctx.fillText("Mécanique", pad.left+96, ly);
}

function renderTopClients(){
  const zone = document.getElementById("topClients");
  if(!zone) return;
  const mecs = typeof dossiersMecanique !== "undefined" ? dossiersMecanique : [];
  const compteur = {};
  [...dossiers, ...mecs].forEach(d=>{
    const k = (d.client||"").trim().toLowerCase();
    if(!k) return;
    if(!compteur[k]) compteur[k] = {nom:d.client, nb:0, ca:0};
    compteur[k].nb++;
    compteur[k].ca += Number(d.facture||d.devis||0);
  });
  const top = Object.values(compteur).sort((a,b)=>b.nb-a.nb).slice(0,5);
  if(!top.length){ zone.innerHTML='<p style="color:var(--muted);font-size:13px;">Aucun client</p>'; return; }
  const maxNb = top[0].nb||1;
  zone.innerHTML = top.map((c,i)=>`
    <div style="margin-bottom:12px;">
      <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px;">
        <span><b>${i+1}.</b> ${escHtml(c.nom)}</span>
        <span style="color:var(--muted);">${c.nb} dossier${c.nb>1?"s":""} — ${c.ca.toLocaleString("fr-FR",{minimumFractionDigits:2})} €</span>
      </div>
      <div style="height:6px;background:#1e293b;border-radius:10px;overflow:hidden;">
        <div style="height:100%;width:${Math.round(c.nb/maxNb*100)}%;background:linear-gradient(90deg,#2563eb,#38bdf8);border-radius:10px;transition:width .4s;"></div>
      </div>
    </div>`).join("");
}

function renderAlertesRetard(){
  const zone = document.getElementById("alertesRetard");
  if(!zone) return;
  const mecs = typeof dossiersMecanique !== "undefined" ? dossiersMecanique : [];
  const auj = new Date(); auj.setHours(0,0,0,0);
  const alertes = [];
  mecs.forEach((d,i)=>{
    if(d.statut==="Terminé"||d.statut==="Facturé") return;
    if(!d.dateSortie) return;
    const dt = new Date(d.dateSortie); dt.setHours(0,0,0,0);
    if(dt < auj){
      const jours = Math.round((auj-dt)/(1000*60*60*24));
      alertes.push({type:"mecanique", d, i, jours, dt});
    }
  });
  dossiers.forEach((d,i)=>{
    if(d.statut==="Terminé"||d.statut==="Facturé") return;
    if(!d.dateReparation) return;
    const dt = new Date(d.dateReparation); dt.setHours(0,0,0,0);
    if(dt < auj){
      const jours = Math.round((auj-dt)/(1000*60*60*24));
      if(jours>3) alertes.push({type:"vitrage", d, i, jours, dt});
    }
  });
  if(!alertes.length){ zone.innerHTML=""; return; }
  zone.innerHTML = `
    <div class="card" style="border-left:4px solid #dc2626;background:#1a0a0a;">
      <h2 style="color:#f87171;margin-bottom:12px;">⚠️ ${alertes.length} dossier${alertes.length>1?"s":""} en retard</h2>
      <div class="table-wrapper" style="margin:0;">
        <table>
          <thead><tr><th>Type</th><th>N°</th><th>Client</th><th>Véhicule</th><th>Date prévue</th><th>Retard</th><th>Statut</th></tr></thead>
          <tbody>${alertes.map(a=>`
            <tr>
              <td>${a.type==="mecanique"?"🔩 Mécanique":"🪟 Vitrage"}</td>
              <td><b>${escHtml(a.d.numero)}</b></td>
              <td>${escHtml(a.d.client)}</td>
              <td>${escHtml((a.d.vehicule||"")+" "+(a.d.immat||""))}</td>
              <td>${a.dt.toLocaleDateString("fr-FR")}</td>
              <td><span style="color:#f87171;font-weight:bold;">+${a.jours} jour${a.jours>1?"s":""}</span></td>
              <td>${escHtml(a.d.statut)}</td>
            </tr>`).join("")}
          </tbody>
        </table>
      </div>
    </div>`;
}

/* ─────────────────────────────────────────────────
   2. VITRAGE — PRISE EN CHARGE ASSURANCE dans renderDossiers
───────────────────────────────────────────────────*/

function badgePriseEnCharge(val){
  if(!val) return "";
  const map = {
    "En attente":    ["#78350f","#fbbf24","⏳"],
    "Acceptée":      ["#166534","#4ade80","✅"],
    "Refusée":       ["#7f1d1d","#f87171","❌"],
    "Partielle":     ["#1e3a5f","#60a5fa","⚠️"],
    "Sans assurance":["#374151","#9ca3af","🚫"],
  };
  const [bg,fg,ico] = map[val]||["#334155","#94a3b8","?"];
  return `<span class="badge" style="background:${bg};color:${fg};margin-left:4px;">${ico} ${escHtml(val)}</span>`;
}

/* ─────────────────────────────────────────────────
   3. CLIENTS — FICHE COMPLÈTE AVEC HISTORIQUE
───────────────────────────────────────────────────*/

function _compterDossiersClient(nom, prenom){
  const mecs = typeof dossiersMecanique !== "undefined" ? dossiersMecanique : [];
  const search = ((nom||"")+" "+(prenom||"")).trim().toLowerCase();
  const nVit = dossiers.filter(d=>(d.client||"").toLowerCase().includes(nom.toLowerCase())).length;
  const nMec = mecs.filter(d=>(d.client||"").toLowerCase().includes(nom.toLowerCase())).length;
  if(!nVit && !nMec) return '<span style="color:#475569;">—</span>';
  return `${nVit?"🪟 "+nVit:""}${nVit&&nMec?" ":""}${nMec?"🔩 "+nMec:""}`;
}

function ficheClientComplet(index){
  const c = clients[index];
  if(!c) return;
  const mecs = typeof dossiersMecanique !== "undefined" ? dossiersMecanique : [];
  const search = (c.nom||"").toLowerCase();
  const dossiersVit = dossiers.filter(d=>(d.client||"").toLowerCase().includes(search));
  const dossiersMec = mecs.filter(d=>(d.client||"").toLowerCase().includes(search));

  const rowsVit = dossiersVit.length ? dossiersVit.map(d=>`
    <tr>
      <td><b>${escHtml(d.numero)}</b></td>
      <td>${escHtml(d.vehicule||"—")} ${escHtml(d.immat||"")}</td>
      <td>${escHtml(d.vitrage||"—")}</td>
      <td>${escHtml(d.dateCreation||"—")}</td>
      <td>${escHtml(d.assurance||"—")}</td>
      <td>${d.facture?Number(d.facture).toLocaleString("fr-FR",{minimumFractionDigits:2})+" €":"—"}</td>
      <td><span class="badge badge-${d.statut==="Terminé"||d.statut==="Facturé"?"success":d.statut==="En cours"?"warning":"danger"}">${escHtml(d.statut)}</span></td>
    </tr>`).join("") : `<tr><td colspan="7" style="text-align:center;color:var(--muted);">Aucun dossier vitrage</td></tr>`;

  const rowsMec = dossiersMec.length ? dossiersMec.map(d=>`
    <tr>
      <td><b>${escHtml(d.numero)}</b></td>
      <td>${escHtml(d.vehicule||"—")} ${escHtml(d.immat||"")}</td>
      <td>${escHtml(d.typePanne||"—")}</td>
      <td>${escHtml(d.dateEntree||"—")}</td>
      <td>${escHtml(d.technicien||"—")}</td>
      <td>${d.facture?Number(d.facture).toLocaleString("fr-FR",{minimumFractionDigits:2})+" €":d.devis?Number(d.devis).toLocaleString("fr-FR",{minimumFractionDigits:2})+" €":"—"}</td>
      <td><span class="badge badge-${d.statut==="Terminé"||d.statut==="Facturé"?"success":d.statut==="En cours"?"warning":"danger"}">${escHtml(d.statut)}</span></td>
    </tr>`).join("") : `<tr><td colspan="7" style="text-align:center;color:var(--muted);">Aucun dossier mécanique</td></tr>`;

  const totalCA = [...dossiersVit,...dossiersMec].reduce((a,d)=>a+Number(d.facture||d.devis||0),0);

  ouvrirModal(`📋 Fiche client — ${c.nom} ${c.prenom||""}`, `
    <div style="display:flex;gap:20px;flex-wrap:wrap;margin-bottom:16px;">
      <div style="flex:1;min-width:200px;">
        <p style="font-size:13px;color:var(--muted);">📞 ${escHtml(c.telephone||"—")}</p>
        <p style="font-size:13px;color:var(--muted);">🪟 ${dossiersVit.length} dossier${dossiersVit.length>1?"s":""} vitrage</p>
        <p style="font-size:13px;color:var(--muted);">🔩 ${dossiersMec.length} dossier${dossiersMec.length>1?"s":""} mécanique</p>
      </div>
      <div style="background:#1e293b;border-radius:12px;padding:12px 20px;text-align:center;">
        <div style="font-size:11px;color:var(--muted);text-transform:uppercase;">CA total</div>
        <div style="font-size:24px;font-weight:bold;color:#38bdf8;">${totalCA.toLocaleString("fr-FR",{minimumFractionDigits:2})} €</div>
      </div>
    </div>
    <h3 style="color:#38bdf8;margin-bottom:8px;">🪟 Dossiers Vitrage</h3>
    <div class="table-wrapper" style="margin-bottom:16px;">
      <table style="font-size:12px;">
        <thead><tr><th>N°</th><th>Véhicule</th><th>Vitrage</th><th>Date</th><th>Assurance</th><th>Montant</th><th>Statut</th></tr></thead>
        <tbody>${rowsVit}</tbody>
      </table>
    </div>
    <h3 style="color:#16a34a;margin-bottom:8px;">🔩 Dossiers Mécanique</h3>
    <div class="table-wrapper">
      <table style="font-size:12px;">
        <thead><tr><th>N°</th><th>Véhicule</th><th>Intervention</th><th>Entrée</th><th>Technicien</th><th>Montant</th><th>Statut</th></tr></thead>
        <tbody>${rowsMec}</tbody>
      </table>
    </div>`, null);

  setTimeout(()=>{
    const btn = document.getElementById("modalBtnOk");
    if(btn) btn.style.display = "none";
  }, 50);
}

/* ─────────────────────────────────────────────────
   4. HISTORIQUE VÉHICULE (étendu vitrage + mécanique)
───────────────────────────────────────────────────*/

function historiqueVehicule(){
  const immat = (document.getElementById("rechercheHistorique")?.value||"").trim().toLowerCase();
  const zone  = document.getElementById("historiqueVehicule");
  if(!zone) return;
  if(immat.length < 2){ zone.innerHTML=""; return; }
  const mecs = typeof dossiersMecanique !== "undefined" ? dossiersMecanique : [];
  const dosVit = dossiers.filter(d=>(d.immat||"").toLowerCase().includes(immat));
  const dosMec = mecs.filter(d=>(d.immat||"").toLowerCase().includes(immat));
  if(!dosVit.length && !dosMec.length){ zone.innerHTML=`<div class="card"><p style="color:var(--muted);">Aucun dossier trouvé pour "${escHtml(immat)}"</p></div>`; return; }

  const totalCA = [...dosVit,...dosMec].reduce((a,d)=>a+Number(d.facture||d.devis||0),0);
  zone.innerHTML = `
    <div class="card" style="margin-bottom:16px;">
      <h2 style="color:#38bdf8;margin-bottom:12px;">🚗 Historique — ${escHtml((dosVit[0]||dosMec[0])?.vehicule||"")} <span style="color:var(--muted);font-size:14px;">${escHtml(immat.toUpperCase())}</span></h2>
      <div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:16px;">
        <span style="background:#1e293b;padding:8px 14px;border-radius:8px;font-size:13px;">🪟 ${dosVit.length} intervention${dosVit.length>1?"s":""} vitrage</span>
        <span style="background:#1e293b;padding:8px 14px;border-radius:8px;font-size:13px;">🔩 ${dosMec.length} intervention${dosMec.length>1?"s":""} mécanique</span>
        <span style="background:#1e293b;padding:8px 14px;border-radius:8px;font-size:13px;color:#38bdf8;">💶 CA total : ${totalCA.toLocaleString("fr-FR",{minimumFractionDigits:2})} €</span>
      </div>
      ${dosVit.length?`
      <h3 style="color:#2563eb;margin-bottom:8px;">🪟 Vitrage</h3>
      <div class="table-wrapper" style="margin-bottom:12px;"><table style="font-size:12px;">
        <thead><tr><th>N°</th><th>Client</th><th>Vitrage</th><th>Date</th><th>Assurance</th><th>Montant</th><th>Statut</th></tr></thead>
        <tbody>${dosVit.map(d=>`<tr><td><b>${escHtml(d.numero)}</b></td><td>${escHtml(d.client)}</td><td>${escHtml(d.vitrage||"—")}</td><td>${escHtml(d.dateCreation||"—")}</td><td>${escHtml(d.assurance||"—")}</td><td>${d.facture?Number(d.facture).toLocaleString("fr-FR",{minimumFractionDigits:2})+" €":"—"}</td><td>${escHtml(d.statut)}</td></tr>`).join("")}</tbody>
      </table></div>`:""}
      ${dosMec.length?`
      <h3 style="color:#16a34a;margin-bottom:8px;">🔩 Mécanique</h3>
      <div class="table-wrapper"><table style="font-size:12px;">
        <thead><tr><th>N°</th><th>Client</th><th>Intervention</th><th>Entrée</th><th>Km</th><th>Montant</th><th>Statut</th></tr></thead>
        <tbody>${dosMec.map(d=>`<tr><td><b>${escHtml(d.numero)}</b></td><td>${escHtml(d.client)}</td><td>${escHtml(d.typePanne||"—")}</td><td>${escHtml(d.dateEntree||"—")}</td><td>${escHtml(d.kilometrage||"—")}</td><td>${d.facture?Number(d.facture).toLocaleString("fr-FR",{minimumFractionDigits:2})+" €":d.devis?Number(d.devis).toLocaleString("fr-FR",{minimumFractionDigits:2})+" €":"—"}</td><td>${escHtml(d.statut)}</td></tr>`).join("")}</tbody>
      </table></div>`:""}
    </div>`;
}

/* ─────────────────────────────────────────────────
   5. CALENDRIER MENSUEL AGENDA
───────────────────────────────────────────────────*/

let _calMois = new Date().getMonth();
let _calAnnee = new Date().getFullYear();

function calendrierAujourdhui(){ _calMois=new Date().getMonth(); _calAnnee=new Date().getFullYear(); renderCalendrierMensuel(); }
function calendrierMoisPrecedent(){ _calMois--; if(_calMois<0){_calMois=11;_calAnnee--;} renderCalendrierMensuel(); }
function calendrierMoisSuivant(){ _calMois++; if(_calMois>11){_calMois=0;_calAnnee++;} renderCalendrierMensuel(); }

function renderCalendrierMensuel(){
  const grille = document.getElementById("grillleCalendrier");
  const label  = document.getElementById("labelMoisCalendrier");
  if(!grille) return;

  const moisNom = new Date(_calAnnee, _calMois, 1).toLocaleDateString("fr-FR",{month:"long",year:"numeric"});
  if(label) label.textContent = moisNom.charAt(0).toUpperCase()+moisNom.slice(1);

  // En-têtes jours
  const jours = ["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"];
  let html = jours.map(j=>`<div style="text-align:center;font-size:11px;font-weight:700;color:var(--muted);padding:4px;text-transform:uppercase;">${j}</div>`).join("");

  const premier = new Date(_calAnnee, _calMois, 1);
  const jourSemaine = (premier.getDay()+6)%7; // 0=lundi
  const nbJours = new Date(_calAnnee, _calMois+1, 0).getDate();
  const aujStr = new Date().toISOString().split("T")[0];

  // Cellules vides avant le 1er
  for(let i=0;i<jourSemaine;i++) html += `<div></div>`;

  for(let j=1;j<=nbJours;j++){
    const dateStr = `${_calAnnee}-${String(_calMois+1).padStart(2,"0")}-${String(j).padStart(2,"0")}`;
    const rdvJour = (typeof rendezVous!=="undefined"?rendezVous:[]).filter(r=>r.date===dateStr);
    const isAuj = dateStr === aujStr;
    const hasMec = (typeof dossiersMecanique!=="undefined"?dossiersMecanique:[]).some(d=>d.dateSortie===dateStr&&d.statut!=="Terminé"&&d.statut!=="Facturé");
    const bg = isAuj ? "background:#2563eb;" : "";
    const border = hasMec ? "border:2px solid #16a34a;" : "border:1px solid #1f2937;";
    html += `<div onclick="filtrerRdvCalendrier('${dateStr}')" style="${bg}${border}border-radius:8px;padding:6px;min-height:64px;cursor:pointer;transition:background .15s;background:${isAuj?"#2563eb":"#1e293b"};">
      <div style="font-size:12px;font-weight:bold;color:${isAuj?"#fff":"#f1f5f9"};">${j}</div>
      ${rdvJour.slice(0,3).map(r=>`<div style="font-size:10px;background:#0f172a;border-radius:4px;padding:2px 4px;margin-top:2px;color:#38bdf8;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;">${escHtml(r.heure||"")} ${escHtml(r.client||"")}</div>`).join("")}
      ${rdvJour.length>3?`<div style="font-size:9px;color:var(--muted);">+${rdvJour.length-3} autre${rdvJour.length-3>1?"s":""}</div>`:""}
      ${hasMec?`<div style="font-size:9px;color:#4ade80;margin-top:2px;">🔩 Sortie prévue</div>`:""}
    </div>`;
  }
  grille.innerHTML = html;
}

function filtrerRdvCalendrier(dateStr){
  const el = document.getElementById("filtreDate");
  if(el){ el.value = dateStr; rechercherRdv(); }
  // Scroll vers la liste des RDV
  const liste = document.getElementById("listeRendezVous");
  if(liste) liste.scrollIntoView({behavior:"smooth"});
}

/* ─────────────────────────────────────────────────
   6. EXPORT EXCEL GLOBAL
───────────────────────────────────────────────────*/

function exporterExcelGlobal(){
  const mecs = typeof dossiersMecanique !== "undefined" ? dossiersMecanique : [];

  // Build CSV (compatible Excel avec séparateur ;)
  const sep = ";";
  const lignes = [];

  // En-tête
  lignes.push(["EXPORT OPR — " + new Date().toLocaleDateString("fr-FR")].join(sep));
  lignes.push([]);

  // ── Dossiers Vitrage ──
  lignes.push(["DOSSIERS VITRAGE"].join(sep));
  lignes.push(["N°","Client","Véhicule","Immat","Vitrage","Assurance","PEC","Montant remboursé","Devis","Facture","Franchise","Statut","Date création"].join(sep));
  dossiers.forEach(d=>{
    lignes.push([
      d.numero, d.client, (d.vehicule||"")+" "+(d.modele||""), d.immat||"",
      d.vitrage||"", d.assurance||"", d.statutPriseEnCharge||"",
      d.montantRembourse||"", d.devis||"", d.facture||"",
      d.franchise||"", d.statut, d.dateCreation||""
    ].map(v=>'"'+String(v||"").replace(/"/g,'""')+'"').join(sep));
  });

  lignes.push([]);
  // ── Dossiers Mécanique ──
  lignes.push(["DOSSIERS MÉCANIQUE"].join(sep));
  lignes.push(["N°","OR","Client","Véhicule","Immat","Km","Type intervention","Technicien","Entrée","Sortie prévue","Devis","Facture","Statut","Date création"].join(sep));
  mecs.forEach(d=>{
    lignes.push([
      d.numero, d.ordreReparationNumero||"", d.client,
      (d.vehicule||""), d.immat||"", d.kilometrage||"",
      d.typePanne||"", d.technicien||"", d.dateEntree||"", d.dateSortie||"",
      d.devis||"", d.facture||"", d.statut, d.dateCreation||""
    ].map(v=>'"'+String(v||"").replace(/"/g,'""')+'"').join(sep));
  });

  lignes.push([]);
  // ── Clients ──
  lignes.push(["CLIENTS"].join(sep));
  lignes.push(["Nom","Prénom","Téléphone"].join(sep));
  clients.forEach(c=>{
    lignes.push([c.nom||"", c.prenom||"", c.telephone||""].map(v=>'"'+String(v||"").replace(/"/g,'""')+'"').join(sep));
  });

  const bom = "\uFEFF"; // UTF-8 BOM pour Excel
  const csv = bom + lignes.map(l=>Array.isArray(l)?l.join(sep):l).join("\n");
  const blob = new Blob([csv], {type:"text/csv;charset=utf-8;"});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url;
  a.download = "opr-export-" + new Date().toISOString().split("T")[0] + ".csv";
  document.body.appendChild(a);
  a.click();
  setTimeout(()=>{ document.body.removeChild(a); URL.revokeObjectURL(url); }, 500);
  toast("Export Excel téléchargé ✓");
}

/* ─────────────────────────────────────────────────
   7. MODE CLAIR / SOMBRE
───────────────────────────────────────────────────*/

function toggleTheme(){
  const body = document.body;
  const isDark = !body.classList.contains("theme-light");
  body.classList.toggle("theme-light", isDark);
  localStorage.setItem("theme", isDark?"light":"dark");
  const btn = document.getElementById("btnTheme");
  if(btn) btn.textContent = isDark ? "🌙 Mode sombre" : "☀️ Mode clair";
}

function initTheme(){
  const saved = localStorage.getItem("theme");
  if(saved==="light"){
    document.body.classList.add("theme-light");
    const btn = document.getElementById("btnTheme");
    if(btn) btn.textContent = "🌙 Mode sombre";
  }
}

// Appel à l'initialisation
document.addEventListener("DOMContentLoaded", ()=>{ initTheme(); majNumeroDocument(); initConnexionGoogle(); });

window.addEventListener("beforeunload", function(e){
  if(typeof _dataSaved !== "undefined" && _dataSaved === false){
    e.preventDefault();
    e.returnValue = "Des modifications ne sont pas encore sauvegardées. Quitter quand même ?";
  }
});


/* =====================================================
   RELANCES ASSURANCE
===================================================== */

function initRelancesAssurance(){
  // Remplir le filtre assurances
  const sel = document.getElementById("filtreRelanceAssurance");
  if(sel){
    const nomsAssurances = [...new Set(dossiers.filter(d=>d.assurance).map(d=>d.assurance))].sort();
    sel.innerHTML = '<option value="">Toutes les assurances</option>' +
      nomsAssurances.map(a=>`<option value="${escHtml(a)}">${escHtml(a)}</option>`).join("");
  }
  renderRelancesAssurance();
}

function _getDossiersARelancer(){
  return dossiers.filter(d => {
    const pec = d.statutPriseEnCharge || "";
    return pec === "En attente" || pec === "Partielle";
  });
}

function _joursDepuis(dateStr){
  if(!dateStr) return 0;
  const d = new Date(dateStr);
  if(isNaN(d)) return 0;
  return Math.floor((new Date() - d) / (1000*60*60*24));
}

function renderRelancesAssurance(){
  const filtreAss   = document.getElementById("filtreRelanceAssurance")?.value  || "";
  const filtreStatut= document.getElementById("filtreRelanceStatut")?.value    || "";
  const filtreDelai = parseInt(document.getElementById("filtreRelanceDelai")?.value || "0") || 0;

  let liste = _getDossiersARelancer();
  if(filtreAss)    liste = liste.filter(d=>(d.assurance||"")===filtreAss);
  if(filtreStatut) liste = liste.filter(d=>(d.statutPriseEnCharge||"")===filtreStatut);
  if(filtreDelai)  liste = liste.filter(d=>_joursDepuis(d.dateCreation||d.dateSinistre)>=filtreDelai);

  // Trier par délai décroissant (les plus anciens en premier)
  liste.sort((a,b)=>_joursDepuis(b.dateCreation||b.dateSinistre)-_joursDepuis(a.dateCreation||a.dateSinistre));

  // Compteurs
  const aRelancer = _getDossiersARelancer();
  let att=0, part=0, urgent=0, montantTotal=0;
  aRelancer.forEach(d=>{
    if(d.statutPriseEnCharge==="En attente") att++;
    if(d.statutPriseEnCharge==="Partielle")  part++;
    if(_joursDepuis(d.dateCreation||d.dateSinistre)>=30) urgent++;
    const montant = Number(d.facture||d.devis||0);
    const rembourse = Number(d.montantRembourse||0);
    montantTotal += Math.max(0, montant-rembourse);
  });
  const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};
  set("relCompteurAttente",  att);
  set("relCompteurPartielle",part);
  set("relCompteurUrgent",   urgent);
  set("relMontantTotal",     montantTotal.toLocaleString("fr-FR",{minimumFractionDigits:2})+" €");

  // Badge menu
  const badge = document.getElementById("badgeRelances");
  if(badge){ badge.textContent = aRelancer.length > 0 ? aRelancer.length : ""; }

  // Tableau
  const tbody = document.getElementById("listeRelancesAssurance");
  if(!tbody) return;

  if(!liste.length){
    tbody.innerHTML=`<tr><td colspan="12" style="text-align:center;color:var(--muted);padding:24px;">✅ Aucune relance en attente avec ces filtres</td></tr>`;
    return;
  }

  tbody.innerHTML = liste.map(d=>{
    const idx = dossiers.indexOf(d);
    const jours = _joursDepuis(d.dateCreation||d.dateSinistre);
    const montant   = Number(d.facture||d.devis||0);
    const rembourse = Number(d.montantRembourse||0);
    const resteDu   = Math.max(0, montant-rembourse);
    const urgence   = jours>=30 ? "color:#f87171;font-weight:bold;" : jours>=15 ? "color:#fbbf24;" : "color:#94a3b8;";
    const pecBadge  = d.statutPriseEnCharge==="En attente"
      ? `<span class="badge" style="background:#78350f;color:#fbbf24;">⏳ En attente</span>`
      : `<span class="badge" style="background:#1e3a5f;color:#60a5fa;">⚠️ Partielle</span>`;

    const derniereRelance = d.derniereRelance
      ? new Date(d.derniereRelance).toLocaleDateString("fr-FR")
      : `<span style="color:#475569;">—</span>`;

    return `<tr>
      <td><b>${escHtml(d.numero)}</b></td>
      <td>${escHtml(d.client)}</td>
      <td>
        <div style="font-weight:bold;font-size:13px;">${escHtml(d.vehicule||"—")} ${escHtml(d.modele||"")}</div>
        <div style="color:var(--muted);font-size:12px;">${escHtml(d.immat||"—")}</div>
      </td>
      <td><b>${escHtml(d.assurance||"—")}</b></td>
      <td>${pecBadge}</td>
      <td>${montant ? montant.toLocaleString("fr-FR",{minimumFractionDigits:2})+" €" : "—"}</td>
      <td style="color:#4ade80;">${rembourse ? rembourse.toLocaleString("fr-FR",{minimumFractionDigits:2})+" €" : "—"}</td>
      <td style="color:#f87171;font-weight:bold;">${resteDu ? resteDu.toLocaleString("fr-FR",{minimumFractionDigits:2})+" €" : "—"}</td>
      <td>${escHtml(d.dateCreation||"—")}</td>
      <td style="${urgence}">${jours} jour${jours>1?"s":""}</td>
      <td style="font-size:12px;">${derniereRelance}</td>
      <td style="white-space:nowrap;">
        <button onclick="ouvrirRelanceEmail(${idx})" style="background:#2563eb;padding:6px 10px;font-size:12px;">✉️ Relancer</button>
        <button onclick="marquerRelanceEffectuee(${idx})" style="background:#16a34a;padding:6px 10px;font-size:12px;">✅ Marqué</button>
        <button onclick="ouvrirDossier(${idx})" style="background:#334155;padding:6px 10px;font-size:12px;">📁 Dossier</button>
      </td>
    </tr>`;
  }).join("");
}

/* ── Ouvrir modal de relance email/téléphone ── */
function ouvrirRelanceEmail(index){
  const d = dossiers[index];
  if(!d) return;
  const ent     = entreprise || {};
  const dateAuj = new Date().toLocaleDateString("fr-FR");
  const montant   = Number(d.facture||d.devis||0);
  const rembourse = Number(d.montantRembourse||0);
  const resteDu   = Math.max(0, montant-rembourse);
  const jours     = _joursDepuis(d.dateCreation||d.dateSinistre);

  const assuranceInfo        = trouverAssurance(d.assurance||"") || {};
  const telAssurance         = assuranceInfo.telephone || d.telephoneAssurance || "";
  const emailAssurance       = assuranceInfo.email     || d.emailAssurance     || "";
  const adresseAssurance     = assuranceInfo.adresse   || d.adresseAssurance   || "";
  const documentsRequis      = assuranceInfo.documents || "";

  // ── Courrier pré-rempli professionnel ──
  const ligneRembourse = rembourse
    ? `\n- Montant déjà remboursé : ${rembourse.toLocaleString("fr-FR",{minimumFractionDigits:2})} €\n- Reste dû              : ${resteDu.toLocaleString("fr-FR",{minimumFractionDigits:2})} €`
    : "";

  const courrierTexte =
`${ent.nom||"DA-Gestion"}
${ent.adresse||""}
${ent.telephone||""}  ${ent.email||""}
SIRET : ${ent.siret||"—"}

${dateAuj}

${d.assurance||"Compagnie d'assurance"}
${adresseAssurance}

Objet : RELANCE — Prise en charge sinistre N° ${d.sinistre||"—"} — Dossier N° ${d.numero}

Madame, Monsieur,

Sauf erreur de notre part, nous n'avons pas reçu de réponse de votre part concernant la prise en charge du dossier ci-dessous, ouvert le ${d.dateCreation||"—"}.

COORDONNÉES CLIENT
──────────────────────────────────────────
Nom          : ${d.client||"—"}
Véhicule     : ${d.vehicule||"—"} ${d.modele||""} ${d.immat?"— Immat : "+d.immat:""}
Contrat N°   : ${d.contrat||"—"}
N° sinistre  : ${d.sinistre||"—"}
Date sinistre: ${d.dateSinistre||"—"}

DÉTAIL DE L'INTERVENTION
──────────────────────────────────────────
Vitrage      : ${d.vitrage||"—"}
Type dommage : ${d.typeDommage||"—"}
Franchise    : ${d.franchise||"—"} ${d.montantFranchise?"("+d.montantFranchise+" €)":""}
Montant HT   : ${montant?(montant/1.2).toLocaleString("fr-FR",{minimumFractionDigits:2})+" €":"—"}
Montant TTC  : ${montant?montant.toLocaleString("fr-FR",{minimumFractionDigits:2})+" €":"—"}${ligneRembourse}

${documentsRequis?"Documents transmis : "+documentsRequis+"\n\n":""}Nous vous informons que sans réponse de votre part sous 8 jours ouvrés, nous serons dans l'obligation de facturer directement notre client.

Dans l'attente de votre retour, nous restons à votre disposition pour tout renseignement complémentaire.

Veuillez agréer, Madame, Monsieur, l'expression de nos salutations distinguées.

${ent.nom||"DA-Gestion"}
${ent.telephone||""}
${ent.email||""}`;

  ouvrirModal(`✉️ Courrier de relance — Dossier ${d.numero}`, `
    <div style="display:flex;flex-direction:column;gap:14px;">

      <!-- Résumé coordonnées -->
      <div style="display:flex;gap:10px;flex-wrap:wrap;">
        <div style="flex:1;min-width:180px;background:#0f172a;border:1px solid #1e293b;border-radius:10px;padding:12px;">
          <div style="font-size:11px;color:#64748b;text-transform:uppercase;margin-bottom:6px;">🏢 Assurance</div>
          <div style="font-weight:bold;font-size:13px;">${escHtml(d.assurance||"—")}</div>
          ${telAssurance?`<div style="font-size:12px;color:#38bdf8;margin-top:4px;">📞 ${escHtml(telAssurance)}</div>`:""}
          ${emailAssurance?`<div style="font-size:12px;color:#38bdf8;">📧 ${escHtml(emailAssurance)}</div>`:""}
          ${adresseAssurance?`<div style="font-size:11px;color:#64748b;margin-top:4px;">${escHtml(adresseAssurance)}</div>`:""}
        </div>
        <div style="flex:1;min-width:180px;background:#0f172a;border:1px solid #1e293b;border-radius:10px;padding:12px;">
          <div style="font-size:11px;color:#64748b;text-transform:uppercase;margin-bottom:6px;">👤 Client</div>
          <div style="font-weight:bold;font-size:13px;">${escHtml(d.client||"—")}</div>
          <div style="font-size:12px;color:#94a3b8;">${escHtml(d.vehicule||"—")} ${escHtml(d.immat||"")}</div>
          <div style="font-size:12px;color:#94a3b8;">Sinistre : ${escHtml(d.sinistre||"—")}</div>
          <div style="font-size:12px;color:#f87171;margin-top:4px;">⏱ ${jours} jours sans réponse</div>
        </div>
        <div style="flex:1;min-width:180px;background:#0f172a;border:1px solid #1e293b;border-radius:10px;padding:12px;">
          <div style="font-size:11px;color:#64748b;text-transform:uppercase;margin-bottom:6px;">💶 Montants</div>
          <div style="font-size:13px;">Total : <b style="color:#38bdf8;">${montant?montant.toLocaleString("fr-FR",{minimumFractionDigits:2})+" €":"—"}</b></div>
          ${rembourse?`<div style="font-size:12px;color:#4ade80;">Remboursé : ${rembourse.toLocaleString("fr-FR",{minimumFractionDigits:2})} €</div>`:""}
          ${resteDu?`<div style="font-size:12px;color:#f87171;font-weight:bold;">Reste dû : ${resteDu.toLocaleString("fr-FR",{minimumFractionDigits:2})} €</div>`:""}
        </div>
      </div>

      <!-- Sélecteur modèle de courrier -->
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
        <label style="font-size:12px;color:#64748b;">📝 Modèle :</label>
        <select id="rel_modele" onchange="changerModeleRelance(${index})" style="font-size:13px;flex:1;min-width:200px;">
          <option value="standard">Relance standard (1ère relance)</option>
          <option value="urgente">Relance urgente (+30 jours)</option>
          <option value="mise_demeure">Mise en demeure formelle</option>
          <option value="confirmation">Confirmation de prise en charge reçue</option>
        </select>
      </div>

      <!-- Email destinataire -->
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <div style="flex:1;">
          <label style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:4px;">📧 Email assurance</label>
          <input type="email" id="rel_email" value="${escHtml(emailAssurance)}" placeholder="service.sinistres@assurance.fr" style="width:100%;">
        </div>
        <div style="flex:1;">
          <label style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:4px;">📋 Objet</label>
          <input type="text" id="rel_sujet" value="${escHtml("RELANCE — Prise en charge N°"+(d.sinistre||d.numero)+" — "+d.client)}" style="width:100%;">
        </div>
      </div>

      <!-- Corps du courrier -->
      <div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px;">
          <label style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.5px;">💬 Courrier</label>
          <div style="display:flex;gap:6px;">
            <button onclick="copierMessageRelance()" style="background:#334155;padding:5px 10px;font-size:11px;">📋 Copier</button>
            <button onclick="imprimerCourrierRelance(${index})" style="background:#7c3aed;padding:5px 10px;font-size:11px;">🖨 Imprimer</button>
            ${telAssurance?`<button onclick="window.open('tel:${escHtml(telAssurance)}')" style="background:#0891b2;padding:5px 10px;font-size:11px;">📞 Appeler</button>`:""}
          </div>
        </div>
        <textarea id="rel_message" rows="14" style="width:100%;font-size:12px;font-family:'Courier New',monospace;line-height:1.5;resize:vertical;background:#0a0f1a;border:1px solid #1e293b;color:#e2e8f0;border-radius:8px;padding:12px;">${escHtml(courrierTexte)}</textarea>
      </div>

    </div>`,
    function(){
      const email   = document.getElementById("rel_email")?.value.trim();
      const sujet   = document.getElementById("rel_sujet")?.value.trim() || "Relance prise en charge";
      const message = document.getElementById("rel_message")?.value.trim();
      if(!message){ toast("Courrier vide","error"); return false; }
      if(!email){ toast("Indiquez l'email de l'assurance","error"); return false; }
      window.open("mailto:"+encodeURIComponent(email)+"?subject="+encodeURIComponent(sujet)+"&body="+encodeURIComponent(message));
      marquerRelanceEffectuee(index);
      enregistrerHistoriqueRelance(index, message);
      toast("Email ouvert ✓ — relance enregistrée");
    }
  );
  setTimeout(()=>{
    const btn = document.getElementById("modalBtnOk");
    if(btn){ btn.textContent="📧 Envoyer l'email"; btn.style.background="#2563eb"; btn.style.padding="10px 20px"; }
  }, 50);
}

/* Changer le modèle de courrier */
function changerModeleRelance(index){
  const d   = dossiers[index];
  const ent = entreprise || {};
  const sel = document.getElementById("rel_modele")?.value;
  const dateAuj = new Date().toLocaleDateString("fr-FR");
  const montant   = Number(d.facture||d.devis||0);
  const rembourse = Number(d.montantRembourse||0);
  const resteDu   = Math.max(0, montant-rembourse);
  const assuranceInfo = trouverAssurance(d.assurance||"") || {};
  const adresseAssurance = assuranceInfo.adresse || d.adresseAssurance || "";
  const jours = _joursDepuis(d.dateCreation||d.dateSinistre);
  let texte = "";

  if(sel === "urgente"){
    texte =
`${ent.nom||"DA-Gestion"}
${ent.adresse||""} — Tél : ${ent.telephone||""} — ${ent.email||""}

${dateAuj}

${d.assurance||"Compagnie d'assurance"}
${adresseAssurance}

Objet : RELANCE URGENTE — Dossier N° ${d.numero} — Sinistre N° ${d.sinistre||"—"}

Madame, Monsieur,

Malgré notre précédente relance, nous n'avons toujours pas reçu de réponse concernant la prise en charge du dossier ci-dessus.

Ce dossier est en attente depuis ${jours} jours. Sans retour de votre part sous 5 jours ouvrés, nous nous verrons contraints de :
  1. Facturer la totalité de la prestation directement à votre assuré(e) — ${d.client}
  2. Informer votre assuré(e) de l'absence de réponse de votre part
  3. Transmettre le dossier à notre service contentieux

Montant en attente : ${montant.toLocaleString("fr-FR",{minimumFractionDigits:2})} €${resteDu&&rembourse?" (reste dû : "+resteDu.toLocaleString("fr-FR",{minimumFractionDigits:2})+" €)":""}
Véhicule : ${d.vehicule||"—"} — Immat : ${d.immat||"—"}
Contrat N° : ${d.contrat||"—"} — N° sinistre : ${d.sinistre||"—"}

Veuillez agréer, Madame, Monsieur, nos salutations distinguées.

${ent.nom||"DA-Gestion"} — ${ent.telephone||""} — ${ent.email||""}`;

  } else if(sel === "mise_demeure"){
    texte =
`${ent.nom||"DA-Gestion"}
${ent.adresse||""} — Tél : ${ent.telephone||""} — ${ent.email||""}
SIRET : ${ent.siret||"—"}

LETTRE RECOMMANDÉE AVEC ACCUSÉ DE RÉCEPTION

${dateAuj}

${d.assurance||"Compagnie d'assurance"}
${adresseAssurance}

Objet : MISE EN DEMEURE — Dossier N° ${d.numero}

Madame, Monsieur,

Par la présente, nous vous mettons en demeure de procéder au règlement de la prise en charge du sinistre N° ${d.sinistre||"—"} concernant votre assuré(e) ${d.client}, dans un délai de 15 jours à compter de la réception du présent courrier.

RÉCAPITULATIF DU DOSSIER
• Assuré         : ${d.client}
• Véhicule       : ${d.vehicule||"—"} — Immat : ${d.immat||"—"}
• N° contrat     : ${d.contrat||"—"}
• N° sinistre    : ${d.sinistre||"—"}
• Date sinistre  : ${d.dateSinistre||"—"}
• Intervention   : ${d.vitrage||"—"}
• Montant TTC    : ${montant.toLocaleString("fr-FR",{minimumFractionDigits:2})} €
• Dossier ouvert depuis : ${jours} jours

À défaut de règlement sous ce délai, nous nous réservons le droit d'engager toute procédure judiciaire nécessaire au recouvrement de cette créance, ainsi que des intérêts de retard au taux légal majoré.

Veuillez agréer, Madame, Monsieur, l'expression de nos salutations distinguées.

${ent.nom||"DA-Gestion"}
${ent.telephone||""} — ${ent.email||""}
SIRET : ${ent.siret||"—"}`;

  } else if(sel === "confirmation"){
    texte =
`${ent.nom||"DA-Gestion"}
${ent.adresse||""} — Tél : ${ent.telephone||""}

${dateAuj}

${d.assurance||"Compagnie d'assurance"}

Objet : Confirmation de réception — Prise en charge N° ${d.sinistre||"—"}

Madame, Monsieur,

Nous accusons bonne réception de votre accord de prise en charge concernant le dossier N° ${d.numero} — ${d.client}.

Nous procédons à la clôture du dossier et vous confirmons les informations suivantes :
• Montant pris en charge : ${rembourse?rembourse.toLocaleString("fr-FR",{minimumFractionDigits:2})+" €":"à définir"}
• Franchise client      : ${d.montantFranchise||"—"} €
• Véhicule             : ${d.vehicule||"—"} — ${d.immat||"—"}

Nous vous remercions pour votre traitement rapide de ce dossier.

Cordialement,
${ent.nom||"DA-Gestion"} — ${ent.telephone||""}`;

  } else {
    // Standard — reconstruire le courrier par défaut
    const assInfo2 = trouverAssurance(d.assurance||"") || {};
    const docs2 = assInfo2.documents || "";
    const ligneRembourse2 = rembourse
      ? "\n- Montant déjà remboursé : "+rembourse.toLocaleString("fr-FR",{minimumFractionDigits:2})+" €\n- Reste dû              : "+resteDu.toLocaleString("fr-FR",{minimumFractionDigits:2})+" €"
      : "";
    texte =
`${ent.nom||"DA-Gestion"}
${ent.adresse||""}
${ent.telephone||""}  ${ent.email||""}
SIRET : ${ent.siret||"—"}

${dateAuj}

${d.assurance||"Compagnie d'assurance"}
${adresseAssurance}

Objet : RELANCE — Prise en charge sinistre N° ${d.sinistre||"—"} — Dossier N° ${d.numero}

Madame, Monsieur,

Sauf erreur de notre part, nous n'avons pas reçu de réponse de votre part concernant la prise en charge du dossier ci-dessous, ouvert le ${d.dateCreation||"—"}.

COORDONNÉES CLIENT
──────────────────────────────────────────
Nom          : ${d.client||"—"}
Véhicule     : ${d.vehicule||"—"} ${d.modele||""} ${d.immat?"— Immat : "+d.immat:""}
Contrat N°   : ${d.contrat||"—"}
N° sinistre  : ${d.sinistre||"—"}
Date sinistre: ${d.dateSinistre||"—"}

DÉTAIL DE L'INTERVENTION
──────────────────────────────────────────
Vitrage      : ${d.vitrage||"—"}
Type dommage : ${d.typeDommage||"—"}
Franchise    : ${d.franchise||"—"} ${d.montantFranchise?"("+d.montantFranchise+" €)":""}
Montant TTC  : ${montant?montant.toLocaleString("fr-FR",{minimumFractionDigits:2})+" €":"—"}${ligneRembourse2}

${docs2?"Documents transmis : "+docs2+"\n\n":""}Sans réponse de votre part dans les 8 jours ouvrés, nous serons dans l'obligation de facturer directement notre client.

Veuillez agréer, Madame, Monsieur, l'expression de nos salutations distinguées.

${ent.nom||"DA-Gestion"}
${ent.telephone||""} — ${ent.email||""}`;
  }

  const el = document.getElementById("rel_message");
  if(el) el.value = texte;
}

/* Imprimer le courrier de relance */
function imprimerCourrierRelance(index){
  const d   = dossiers[index];
  const ent = entreprise || {};
  const msg = document.getElementById("rel_message")?.value || "";
  const f   = window.open("","_blank","width=800,height=900");
  f.document.write(`<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8">
  <title>Courrier relance — ${d.numero}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box;}
    body{font-family:Arial,sans-serif;font-size:12px;color:#111;padding:40px;max-width:680px;margin:0 auto;line-height:1.7;}
    pre{font-family:Arial,sans-serif;font-size:12px;white-space:pre-wrap;word-wrap:break-word;line-height:1.7;}
    .bandeau{background:#1a3a6a;color:white;padding:12px 20px;border-radius:6px;margin-bottom:28px;display:flex;justify-content:space-between;align-items:center;}
    .bandeau span{font-size:11px;opacity:.8;}
    @media print{.bandeau{-webkit-print-color-adjust:exact;print-color-adjust:exact;}}
  </style></head><body>
  <div class="bandeau">
    <b>${escHtml(ent.nom||"DA-Gestion")}</b>
    <span>Dossier N° ${escHtml(d.numero)} — ${new Date().toLocaleDateString("fr-FR")}</span>
  </div>
  <pre>${escHtml(msg)}</pre>
  </body></html>`);
  f.document.close();
  setTimeout(()=>f.print(), 400);
}

function copierMessageRelance(){
  const msg = document.getElementById("rel_message")?.value;
  if(!msg) return;
  navigator.clipboard.writeText(msg).then(()=>toast("Message copié ✓")).catch(()=>toast("Copiez manuellement","error"));
}

/* ── Marquer une relance comme effectuée ── */
function marquerRelanceEffectuee(index){
  if(!dossiers[index]) return;
  dossiers[index].derniereRelance = new Date().toISOString();
  dossiers[index].nbRelances = (dossiers[index].nbRelances||0) + 1;
  saveData();
  renderRelancesAssurance();
  toast("Relance enregistrée ✓");
}

/* ── Enregistrer l'historique ── */
function enregistrerHistoriqueRelance(index, message){
  const d = dossiers[index];
  if(!d.historiqueRelances) d.historiqueRelances = [];
  d.historiqueRelances.push({
    date: new Date().toISOString(),
    message: message.substring(0, 200)+"..."
  });
  saveData();
}

/* ── Relancer tout d'un coup ── */
function toutMarquerRelance(){
  const liste = _getDossiersARelancer();
  if(!liste.length){ toast("Aucune relance à effectuer","error"); return; }
  confirmerAction(`Marquer ${liste.length} dossier${liste.length>1?"s":""} comme relancé${liste.length>1?"s":""}  aujourd'hui ?`, ()=>{
    liste.forEach(d=>{
      d.derniereRelance = new Date().toISOString();
      d.nbRelances = (d.nbRelances||0)+1;
    });
    saveData();
    renderRelancesAssurance();
    toast(`${liste.length} relance${liste.length>1?"s":""} enregistrée${liste.length>1?"s":""} ✓`);
  });
}

/* ── Export CSV des relances ── */
function exporterRelancesCSV(){
  const liste = _getDossiersARelancer();
  const sep = ";";
  const bom = "\uFEFF";
  const lignes = [
    ["N°","Client","Véhicule","Immat","Assurance","N° sinistre","PEC","Montant","Remboursé","Reste dû","Date dossier","Délai (jours)","Dernière relance","Nb relances"].join(sep),
    ...liste.map(d=>{
      const montant   = Number(d.facture||d.devis||0);
      const rembourse = Number(d.montantRembourse||0);
      return [
        d.numero, d.client, (d.vehicule||"")+" "+(d.modele||""), d.immat||"",
        d.assurance||"", d.sinistre||"",
        d.statutPriseEnCharge||"",
        montant.toFixed(2), rembourse.toFixed(2), Math.max(0,montant-rembourse).toFixed(2),
        d.dateCreation||"",
        _joursDepuis(d.dateCreation||d.dateSinistre),
        d.derniereRelance ? new Date(d.derniereRelance).toLocaleDateString("fr-FR") : "",
        d.nbRelances||0
      ].map(v=>'"'+String(v||"").replace(/"/g,'""')+'"').join(sep);
    })
  ];
  const csv = bom + lignes.join("\n");
  const blob = new Blob([csv], {type:"text/csv;charset=utf-8;"});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url;
  a.download = "relances-assurance-" + new Date().toISOString().split("T")[0] + ".csv";
  document.body.appendChild(a); a.click();
  setTimeout(()=>{ document.body.removeChild(a); URL.revokeObjectURL(url); }, 500);
  toast("Export CSV téléchargé ✓");
}

/* ── Rafraîchir le badge relances au chargement ── */
function majBadgeRelances(){
  const nb = _getDossiersARelancer().length;
  const badge = document.getElementById("badgeRelances");
  if(badge) badge.textContent = nb > 0 ? nb : "";
}

/* =====================================================
   TABLEAU DE BORD MÉCANIQUE
===================================================== */

function renderDashboardMecanique(){
  const mecs = typeof dossiersMecanique !== "undefined" ? dossiersMecanique : [];
  let att=0,pieces=0,enc=0,term=0,fact=0,ca=0;
  mecs.forEach(d=>{
    if(d.statut==="En attente") att++;
    if(d.statut==="En attente pièces") pieces++;
    if(d.statut==="En cours") enc++;
    if(d.statut==="Terminé") term++;
    if(d.statut==="Facturé") fact++;
    ca += Number(d.facture||d.devis||0);
  });
  const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};
  set("md_attente",att); set("md_pieces",pieces); set("md_encours",enc);
  set("md_termine",term); set("md_facture",fact);
  set("md_ca", ca.toLocaleString("fr-FR",{minimumFractionDigits:2})+" €");

  _renderGraphiqueCAMeca(mecs);
  _renderTopInterventions(mecs);
  _renderParTechnicien(mecs);
  _renderRappels(mecs);
  _renderDerniersMeca(mecs);
}

function _renderGraphiqueCAMeca(mecs){
  const canvas = document.getElementById("graphiqueCAMeca");
  if(!canvas) return;
  const ctx = canvas.getContext("2d");
  const maintenant = new Date();
  const mois = [];
  for(let i=5;i>=0;i--){
    const d = new Date(maintenant.getFullYear(), maintenant.getMonth()-i, 1);
    mois.push({label:d.toLocaleDateString("fr-FR",{month:"short",year:"2-digit"}),annee:d.getFullYear(),mois:d.getMonth()});
  }
  const caMois = mois.map(m=> mecs.filter(d=>{
    const dt=new Date(d.dateCreation||d.createdAt||"");
    return dt.getFullYear()===m.annee&&dt.getMonth()===m.mois;
  }).reduce((a,d)=>a+Number(d.facture||d.devis||0),0));
  const maxCA=Math.max(...caMois,1);
  const w=canvas.width,h=canvas.height;
  const pad={top:20,right:20,bottom:40,left:60};
  ctx.clearRect(0,0,w,h);
  for(let g=0;g<=4;g++){
    const y=pad.top+(h-pad.top-pad.bottom)*(1-g/4);
    ctx.strokeStyle="#1e293b";ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(pad.left,y);ctx.lineTo(w-pad.right,y);ctx.stroke();
    ctx.fillStyle="#64748b";ctx.font="10px sans-serif";ctx.textAlign="right";
    ctx.fillText((maxCA*g/4).toLocaleString("fr-FR",{maximumFractionDigits:0})+"€",pad.left-4,y+4);
  }
  const totalW=w-pad.left-pad.right;
  const groupW=totalW/mois.length;
  const barW=Math.floor(groupW*0.5);
  mois.forEach((m,i)=>{
    const x=pad.left+i*groupW+groupW/2-barW/2;
    const barH=Math.max(2,(caMois[i]/maxCA)*(h-pad.top-pad.bottom));
    const y=h-pad.bottom-barH;
    ctx.fillStyle="#16a34a";
    ctx.beginPath();
    if(ctx.roundRect) ctx.roundRect(x,y,barW,barH,3);
    else ctx.rect(x,y,barW,barH);
    ctx.fill();
    if(caMois[i]>0){ctx.fillStyle="#f1f5f9";ctx.font="bold 9px sans-serif";ctx.textAlign="center";ctx.fillText(caMois[i].toLocaleString("fr-FR",{maximumFractionDigits:0}),x+barW/2,y-4);}
    ctx.fillStyle="#94a3b8";ctx.font="11px sans-serif";ctx.textAlign="center";
    ctx.fillText(m.label,x+barW/2,h-pad.bottom+16);
  });
}

function _renderTopInterventions(mecs){
  const zone=document.getElementById("md_topInterventions");
  if(!zone) return;
  const compteur={};
  mecs.forEach(d=>{const k=(d.typePanne||"Autre").trim();compteur[k]=(compteur[k]||0)+1;});
  const top=Object.entries(compteur).sort((a,b)=>b[1]-a[1]).slice(0,6);
  const max=top[0]?.[1]||1;
  if(!top.length){zone.innerHTML='<p style="color:var(--muted);font-size:13px;">Aucune donnée</p>';return;}
  zone.innerHTML=top.map(([lib,nb])=>`
    <div style="margin-bottom:10px;">
      <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px;">
        <span>${escHtml(lib)}</span><span style="color:var(--muted);">${nb}x</span>
      </div>
      <div style="height:5px;background:#1e293b;border-radius:10px;overflow:hidden;">
        <div style="height:100%;width:${Math.round(nb/max*100)}%;background:#16a34a;border-radius:10px;"></div>
      </div>
    </div>`).join("");
}

function _renderParTechnicien(mecs){
  const zone=document.getElementById("md_parTechnicien");
  if(!zone) return;
  const stats={};
  mecs.forEach(d=>{
    const k=(d.technicien||"—").trim();
    if(!stats[k]) stats[k]={nb:0,ca:0};
    stats[k].nb++;
    stats[k].ca+=Number(d.facture||d.devis||0);
  });
  const list=Object.entries(stats).sort((a,b)=>b[1].ca-a[1].ca);
  if(!list.length){zone.innerHTML='<p style="color:var(--muted);font-size:13px;">Aucun technicien renseigné</p>';return;}
  zone.innerHTML=`<div class="table-wrapper"><table style="font-size:13px;">
    <thead><tr><th>Technicien</th><th>Dossiers</th><th>CA</th></tr></thead>
    <tbody>${list.map(([nom,s])=>`<tr>
      <td>${escHtml(nom)}</td>
      <td>${s.nb}</td>
      <td style="color:#38bdf8;">${s.ca.toLocaleString("fr-FR",{minimumFractionDigits:2})} €</td>
    </tr>`).join("")}</tbody>
  </table></div>`;
}

function _renderRappels(mecs){
  const zone=document.getElementById("md_rappels");
  if(!zone) return;
  const auj=new Date();
  const rappels=[];
  // Rappels kilométrage vidange (tous les 15 000 km)
  mecs.forEach((d,i)=>{
    const km=parseInt(d.kilometrage||0);
    if(!km) return;
    const prochaine=km+15000;
    rappels.push({
      type:"🛢 Vidange",
      client:d.client,
      vehicule:(d.vehicule||"—")+" "+(d.immat||""),
      info:`Prochaine à ${prochaine.toLocaleString()} km`,
      idx:i,
      urgence: km % 15000 > 12000 ? "rouge" : "normal"
    });
  });
  // Dossiers sans nouvelles depuis +15 jours
  mecs.filter(d=>d.statut==="En cours"||d.statut==="En attente").forEach((d,i)=>{
    const jours=Math.floor((auj-new Date(d.createdAt||d.dateCreation||auj))/(1000*60*60*24));
    if(jours>=15) rappels.push({
      type:"⚠️ Sans nouvelles",
      client:d.client,
      vehicule:(d.vehicule||"—")+" "+(d.immat||""),
      info:`${jours} jours — statut : ${d.statut}`,
      idx:i,
      urgence:"rouge"
    });
  });
  if(!rappels.length){zone.innerHTML='<p style="color:#4ade80;font-size:13px;">✅ Aucun rappel</p>';return;}
  zone.innerHTML=rappels.slice(0,8).map(r=>`
    <div style="display:flex;gap:10px;align-items:flex-start;padding:8px 0;border-bottom:1px solid #1f2937;font-size:12px;">
      <span style="font-size:16px;">${r.urgence==="rouge"?"🔴":"🟡"}</span>
      <div>
        <div style="font-weight:bold;">${r.type} — ${escHtml(r.client)}</div>
        <div style="color:var(--muted);">${escHtml(r.vehicule)}</div>
        <div style="color:#f59e0b;">${escHtml(r.info)}</div>
      </div>
    </div>`).join("");
}

function _renderDerniersMeca(mecs){
  const tbody=document.getElementById("md_listeDerniers");
  if(!tbody) return;
  const derniers=[...mecs].sort((a,b)=>new Date(b.createdAt||b.dateCreation||0)-new Date(a.createdAt||a.dateCreation||0)).slice(0,8);
  if(!derniers.length){tbody.innerHTML='<tr><td colspan="7" style="text-align:center;color:var(--muted);padding:16px;">Aucun dossier</td></tr>';return;}
  tbody.innerHTML=derniers.map(d=>{
    const i=mecs.indexOf(d);
    const montant=d.facture?Number(d.facture).toLocaleString("fr-FR",{minimumFractionDigits:2})+" €":d.devis?Number(d.devis).toLocaleString("fr-FR",{minimumFractionDigits:2})+" €":"—";
    const badge=d.statut==="Terminé"||d.statut==="Facturé"?"success":d.statut==="En cours"?"warning":"danger";
    return `<tr>
      <td><b>${escHtml(d.numero)}</b></td>
      <td>${escHtml(d.client)}</td>
      <td>${escHtml(d.vehicule||"—")} <span style="color:var(--muted);font-size:11px;">${escHtml(d.immat||"")}</span></td>
      <td>${escHtml(d.typePanne||"—")}</td>
      <td>${escHtml(d.dateEntree||"—")}</td>
      <td>${montant}</td>
      <td><span class="badge badge-${badge}">${escHtml(d.statut)}</span></td>
    </tr>`;
  }).join("");
}

/* =====================================================
   EMAIL DEVIS / FACTURE
===================================================== */

function envoyerDocumentEmail(i){
  const doc = documents[i];
  if(!doc) return;
  const ent = entreprise || {};
  const d = doc.dossierIdx !== null ? dossiers[doc.dossierIdx] : null;
  const emailClient = d?.emailClient || "";

  const lignesHtml = doc.lignes.map(l=>{
    const ht=l.qte*l.prixHT;
    const ttc=ht+ht*(l.tva/100);
    return `${l.design} — Qté: ${l.qte} — PU HT: ${Number(l.prixHT).toLocaleString("fr-FR",{minimumFractionDigits:2})}€ — TVA: ${l.tva}% — TTC: ${ttc.toLocaleString("fr-FR",{minimumFractionDigits:2})}€`;
  }).join("\n");

  const msgDefaut = `${doc.type==="facture"?"FACTURE":"DEVIS"} N° ${doc.id}
Date : ${new Date(doc.date||Date.now()).toLocaleDateString("fr-FR")}
${d ? "Client : "+d.client : ""}
${d ? "Véhicule : "+(d.vehicule||"")+" "+(d.immat||"") : ""}

DÉTAIL :
${lignesHtml}

Total HT : ${doc.totalHT.toLocaleString("fr-FR",{minimumFractionDigits:2})} €
TVA : ${doc.totalTVA.toLocaleString("fr-FR",{minimumFractionDigits:2})} €
Total TTC : ${doc.totalTTC.toLocaleString("fr-FR",{minimumFractionDigits:2})} €

${ent.nom||"DA-Gestion"}
${ent.telephone||""}`;

  ouvrirModal(`📧 Envoyer par email — ${doc.id}`, `
    <div style="display:flex;flex-direction:column;gap:12px;">
      <div>
        <label style="font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:5px;">📧 Email destinataire</label>
        <input type="email" id="em_dest" value="${escHtml(emailClient)}" placeholder="client@email.fr" style="width:100%;">
      </div>
      <div>
        <label style="font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:5px;">📝 Objet</label>
        <input type="text" id="em_sujet" value="${escHtml((doc.type==="facture"?"Facture":"Devis")+" N° "+doc.id+" — "+(ent.nom||"DA-Gestion"))}" style="width:100%;">
      </div>
      <div>
        <label style="font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:5px;">💬 Message</label>
        <textarea id="em_corps" rows="10" style="width:100%;font-size:12px;font-family:monospace;resize:vertical;">${msgDefaut}</textarea>
      </div>
      <div style="background:#0f172a;border:1px solid #1e293b;border-radius:8px;padding:10px;font-size:12px;color:#64748b;">
        💡 Cliquez "Envoyer" pour ouvrir votre client mail (Outlook, Gmail...) avec le message pré-rempli.
      </div>
    </div>`,
    function(){
      const dest  = document.getElementById("em_dest")?.value.trim();
      const sujet = document.getElementById("em_sujet")?.value.trim();
      const corps = document.getElementById("em_corps")?.value.trim();
      if(!dest){toast("Email destinataire obligatoire","error");return false;}
      const mailto = `mailto:${encodeURIComponent(dest)}?subject=${encodeURIComponent(sujet)}&body=${encodeURIComponent(corps)}`;
      window.open(mailto);
      toast("Client mail ouvert ✓");
    }
  );
  setTimeout(()=>{const btn=document.getElementById("modalBtnOk");if(btn){btn.textContent="📧 Ouvrir le mail";btn.style.background="#2563eb";}},50);
}

/* =====================================================
   HISTORIQUE DES ACTIONS
===================================================== */

let _historiqueActions = JSON.parse(localStorage.getItem("historiqueActions")||"[]");

function logAction(action, details){
  const user = getSessionUtilisateur();
  const entry = {
    date: new Date().toISOString(),
    user: user?.nom || "—",
    action,
    details: details || ""
  };
  _historiqueActions.unshift(entry);
  if(_historiqueActions.length > 200) _historiqueActions = _historiqueActions.slice(0,200);
  localStorage.setItem("historiqueActions", JSON.stringify(_historiqueActions));
  if(db && _firebaseActif){
    db.ref("/historiqueActions").set(_historiqueActions).catch(()=>{});
  }
}

function afficherHistorique(){
  const h = _historiqueActions.slice(0,50);
  ouvrirModal("📋 Historique des actions", `
    <div style="max-height:450px;overflow-y:auto;">
      <div class="table-wrapper" style="margin:0;">
        <table style="font-size:12px;">
          <thead><tr><th>Date</th><th>Utilisateur</th><th>Action</th><th>Détails</th></tr></thead>
          <tbody>${h.length ? h.map(e=>`<tr>
            <td style="white-space:nowrap;">${new Date(e.date).toLocaleString("fr-FR")}</td>
            <td>${escHtml(e.user)}</td>
            <td><b>${escHtml(e.action)}</b></td>
            <td style="color:var(--muted);">${escHtml(e.details)}</td>
          </tr>`).join("") : '<tr><td colspan="4" style="text-align:center;color:var(--muted);padding:16px;">Aucune action enregistrée</td></tr>'}</tbody>
        </table>
      </div>
    </div>`, null);
  setTimeout(()=>{const btn=document.getElementById("modalBtnOk");if(btn)btn.style.display="none";},50);
}

/* logAction est appelé directement dans les fonctions clés */

/* =====================================================
   MODE HORS-LIGNE (Service Worker simplifié)
===================================================== */

function initModeHorsLigne(){
  // Détecter online/offline
  window.addEventListener("online", ()=>{
    toast("🌐 Connexion rétablie — synchronisation en cours...");
    if(db && _firebaseActif){
      setTimeout(()=>{ sauvegarderFirebase(); },1000);
    }
    const el=document.getElementById("bandeauOffline");
    if(el) el.style.display="none";
  });

  window.addEventListener("offline", ()=>{
    toast("⚠️ Connexion perdue — mode hors-ligne activé","error");
    const el=document.getElementById("bandeauOffline");
    if(el) el.style.display="flex";
  });
}

/* =====================================================
   CONNEXION GOOGLE (via Firebase Auth)
===================================================== */

async function initConnexionGoogle(){
  try {
    await loadScript("https://www.gstatic.com/firebasejs/9.23.0/firebase-auth-compat.js");
    const auth = firebase.auth();
    // Vérifier si déjà connecté via Google
    auth.onAuthStateChanged(user=>{
      if(user){
        const session = getSessionUtilisateur();
        if(!session){
          // Connecter automatiquement si compte Google reconnu
          const users = getUtilisateurs();
          const match = users.find(u=>u.googleEmail===user.email);
          if(match){
            sessionStorage.setItem("session_user", JSON.stringify({...match, googleUser:true}));
            afficherUtilisateurConnecte();
            document.getElementById("loginScreen").style.display="none";
            document.getElementById("appContainer").style.display="flex";
          }
        }
      }
    });
  } catch(e){
    console.warn("Google Auth non disponible:", e.message);
  }
}

async function seConnecterAvecGoogle(){
  try {
    await loadScript("https://www.gstatic.com/firebasejs/9.23.0/firebase-auth-compat.js");
    const auth = firebase.auth();
    const provider = new firebase.auth.GoogleAuthProvider();
    const result = await auth.signInWithPopup(provider);
    const googleUser = result.user;

    // Vérifier si cet email Google est autorisé
    const users = getUtilisateurs();
    const match = users.find(u => u.googleEmail === googleUser.email);

    if(match){
      sessionStorage.setItem("session_user", JSON.stringify({...match, googleUser:true}));
      afficherUtilisateurConnecte();
      document.getElementById("loginScreen").style.display="none";
      document.getElementById("appContainer").style.display="flex";
      toast("✅ Connecté avec Google — "+googleUser.displayName);
    } else {
      toast("⚠️ Compte Google non autorisé. Demandez à l'administrateur d'associer votre email Google.", "error");
      auth.signOut();
    }
  } catch(e){
    toast("Connexion Google échouée : "+e.message, "error");
  }
}

/* initModeHorsLigne appelé au DOMContentLoaded principal ci-dessus */
document.addEventListener("DOMContentLoaded", ()=>{
  initModeHorsLigne();
});


/* =====================================================
   NOUVELLES FONCTIONNALITÉS — PACK COMPLET
===================================================== */

/* ─── MENU HAMBURGER MOBILE ─── */
function toggleMenuMobile(){
  const sidebar = document.getElementById("sidebarMain");
  const btn = document.getElementById("btnMenuMobile");
  if(!sidebar) return;
  const isOpen = sidebar.classList.contains("mobile-open");
  sidebar.classList.toggle("mobile-open", !isOpen);
  if(btn) btn.textContent = isOpen ? "☰" : "✕";
}

/* ─── NOTIFICATION STATUT TERMINÉ ─── */
function verifierNotifStatut(){
  const statut = document.getElementById("statutDossier")?.value;
  const client = document.getElementById("clientDossier")?.value.trim();
  const email  = document.getElementById("emailClient")?.value.trim();
  const tel    = document.getElementById("telephoneDossier")?.value.trim();
  if(statut !== "Terminé") return;
  if(!email && !tel) return;
  // Proposer d'envoyer une notification
  if(email){
    confirmerAction(`Envoyer un email de notification à ${client} (${email}) pour l'informer que son véhicule est prêt ?`, ()=>{
      const ent = entreprise || {};
      const sujet = encodeURIComponent(`Votre véhicule est prêt — ${ent.nom||"DA-Gestion"}`);
      const corps = encodeURIComponent(`Bonjour ${client},\n\nNous avons le plaisir de vous informer que votre véhicule est prêt et disponible à la récupération.\n\nN'hésitez pas à nous contacter pour tout renseignement.\n\nCordialement,\n${ent.nom||"DA-Gestion"}\n${ent.telephone||""}`);
      window.open(`mailto:${email}?subject=${sujet}&body=${corps}`);
      toast("Email de notification ouvert ✓");
    });
  }
}

/* ─── RAPPORT MENSUEL PDF ─── */
function genererRapportMensuel(){
  const mecs = typeof dossiersMecanique !== "undefined" ? dossiersMecanique : [];
  const ent  = entreprise || {};
  const maintenant = new Date();
  const moisLabel  = maintenant.toLocaleDateString("fr-FR",{month:"long",year:"numeric"});
  const moisNum    = maintenant.getMonth();
  const anneeNum   = maintenant.getFullYear();

  const filtreMois = d => {
    const dt = new Date(d.dateCreation||d.createdAt||d.date||"");
    return dt.getMonth()===moisNum && dt.getFullYear()===anneeNum;
  };

  const dossMois = dossiers.filter(filtreMois);
  const mecsMois = mecs.filter(filtreMois);

  const caVit  = dossMois.reduce((a,d)=>a+Number(d.facture||0),0);
  const caMec  = mecsMois.reduce((a,d)=>a+Number(d.facture||d.devis||0),0);
  const caTotal = caVit + caMec;

  // Top 5 clients du mois
  const compteur = {};
  [...dossMois,...mecsMois].forEach(d=>{
    const k=(d.client||"").trim();
    if(!k) return;
    if(!compteur[k]) compteur[k]={nb:0,ca:0};
    compteur[k].nb++;
    compteur[k].ca+=Number(d.facture||d.devis||0);
  });
  const top5 = Object.entries(compteur).sort((a,b)=>b[1].ca-a[1].ca).slice(0,5);

  // Stats par statut vitrage
  const statsVit = {};
  dossMois.forEach(d=>{ statsVit[d.statut]=(statsVit[d.statut]||0)+1; });
  const statsMec = {};
  mecsMois.forEach(d=>{ statsMec[d.statut]=(statsMec[d.statut]||0)+1; });

  const f = window.open("","_blank","width=900,height=1100");
  f.document.write(`<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8">
  <title>Rapport mensuel — ${moisLabel}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box;}
    body{font-family:Arial,sans-serif;font-size:12px;color:#111;padding:32px;max-width:780px;margin:0 auto;}
    .entete{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;padding-bottom:16px;border-bottom:3px solid #1a3a6a;}
    h1{font-size:20px;color:#1a3a6a;}
    h2{font-size:14px;color:#1a3a6a;margin:20px 0 8px;}
    .kpi-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px;}
    .kpi{background:#f0f4ff;border-radius:8px;padding:12px;text-align:center;}
    .kpi-val{font-size:22px;font-weight:bold;color:#1a3a6a;}
    .kpi-lbl{font-size:10px;color:#666;text-transform:uppercase;margin-top:2px;}
    table{width:100%;border-collapse:collapse;margin-bottom:16px;font-size:11px;}
    thead tr{background:#1a3a6a;color:#fff;}
    th{padding:7px 10px;text-align:left;}
    td{padding:6px 10px;border-bottom:1px solid #e2e8f0;}
    .bar-row{display:flex;align-items:center;gap:10px;margin-bottom:6px;}
    .bar{height:14px;background:#1a3a6a;border-radius:4px;min-width:4px;}
    .bar-label{font-size:11px;min-width:140px;}
    .bar-val{font-size:11px;color:#666;}
    @media print{body{padding:12px;}}
  </style></head><body>
  <div class="entete">
    <div>
      <h1>📊 Rapport mensuel</h1>
      <div style="font-size:13px;color:#555;margin-top:4px;">${moisLabel.charAt(0).toUpperCase()+moisLabel.slice(1)}</div>
    </div>
    <div style="text-align:right;">
      <div style="font-weight:bold;">${escHtml(ent.nom||"DA-Gestion")}</div>
      <div style="font-size:11px;color:#666;">${escHtml(ent.adresse||"")}</div>
      <div style="font-size:11px;color:#666;">Généré le ${new Date().toLocaleDateString("fr-FR")}</div>
    </div>
  </div>

  <div class="kpi-grid">
    <div class="kpi"><div class="kpi-val">${dossMois.length}</div><div class="kpi-lbl">Dossiers vitrage</div></div>
    <div class="kpi"><div class="kpi-val">${mecsMois.length}</div><div class="kpi-lbl">Dossiers mécanique</div></div>
    <div class="kpi"><div class="kpi-val">${caTotal.toLocaleString("fr-FR",{maximumFractionDigits:0})} €</div><div class="kpi-lbl">CA total</div></div>
    <div class="kpi"><div class="kpi-val">${(dossMois.length+mecsMois.length?caTotal/(dossMois.length+mecsMois.length):0).toLocaleString("fr-FR",{maximumFractionDigits:0})} €</div><div class="kpi-lbl">Panier moyen</div></div>
  </div>

  <div style="display:flex;gap:20px;margin-bottom:20px;">
    <div style="flex:1;background:#eff6ff;border-radius:8px;padding:14px;">
      <div style="font-size:13px;font-weight:bold;color:#1a3a6a;margin-bottom:8px;">🪟 Vitrage</div>
      <div style="font-size:20px;font-weight:bold;">${caVit.toLocaleString("fr-FR",{minimumFractionDigits:2})} €</div>
      ${Object.entries(statsVit).map(([s,n])=>`<div style="font-size:11px;color:#555;margin-top:4px;">${s} : ${n}</div>`).join("")}
    </div>
    <div style="flex:1;background:#f0fdf4;border-radius:8px;padding:14px;">
      <div style="font-size:13px;font-weight:bold;color:#166534;margin-bottom:8px;">🔩 Mécanique</div>
      <div style="font-size:20px;font-weight:bold;">${caMec.toLocaleString("fr-FR",{minimumFractionDigits:2})} €</div>
      ${Object.entries(statsMec).map(([s,n])=>`<div style="font-size:11px;color:#555;margin-top:4px;">${s} : ${n}</div>`).join("")}
    </div>
  </div>

  <h2>🏆 Top clients du mois</h2>
  <table>
    <thead><tr><th>Client</th><th>Dossiers</th><th>CA</th></tr></thead>
    <tbody>${top5.map(([nom,s])=>`<tr><td>${escHtml(nom)}</td><td>${s.nb}</td><td><b>${s.ca.toLocaleString("fr-FR",{minimumFractionDigits:2})} €</b></td></tr>`).join("")||'<tr><td colspan="3" style="color:#999;text-align:center;">Aucun client ce mois</td></tr>'}</tbody>
  </table>

  <h2>📁 Dossiers vitrage du mois</h2>
  <table>
    <thead><tr><th>N°</th><th>Client</th><th>Véhicule</th><th>Vitrage</th><th>Assurance</th><th>Montant</th><th>Statut</th></tr></thead>
    <tbody>${dossMois.map(d=>`<tr><td>${escHtml(d.numero)}</td><td>${escHtml(d.client)}</td><td>${escHtml(d.vehicule||"")} ${escHtml(d.immat||"")}</td><td>${escHtml(d.vitrage||"—")}</td><td>${escHtml(d.assurance||"—")}</td><td>${d.facture?Number(d.facture).toLocaleString("fr-FR",{minimumFractionDigits:2})+" €":"—"}</td><td>${escHtml(d.statut)}</td></tr>`).join("")||'<tr><td colspan="7" style="color:#999;text-align:center;">Aucun dossier</td></tr>'}</tbody>
  </table>

  <h2>🔩 Dossiers mécanique du mois</h2>
  <table>
    <thead><tr><th>N°</th><th>Client</th><th>Véhicule</th><th>Intervention</th><th>Technicien</th><th>Montant</th><th>Statut</th></tr></thead>
    <tbody>${mecsMois.map(d=>`<tr><td>${escHtml(d.numero)}</td><td>${escHtml(d.client)}</td><td>${escHtml(d.vehicule||"")} ${escHtml(d.immat||"")}</td><td>${escHtml(d.typePanne||"—")}</td><td>${escHtml(d.technicien||"—")}</td><td>${d.facture?Number(d.facture).toLocaleString("fr-FR",{minimumFractionDigits:2})+" €":d.devis?Number(d.devis).toLocaleString("fr-FR",{minimumFractionDigits:2})+" €":"—"}</td><td>${escHtml(d.statut)}</td></tr>`).join("")||'<tr><td colspan="7" style="color:#999;text-align:center;">Aucun dossier</td></tr>'}</tbody>
  </table>

  </body></html>`);
  f.document.close();
  setTimeout(()=>f.print(), 400);
}

/* ─── EXPIRATION SESSION ─── */
let _sessionTimer = null;
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes

function resetSessionTimer(){
  if(_sessionTimer) clearTimeout(_sessionTimer);
  _sessionTimer = setTimeout(()=>{
    const session = getSessionUtilisateur();
    if(session){
      toast("⏰ Session expirée — veuillez vous reconnecter","error");
      setTimeout(()=>{
        sessionStorage.removeItem("session_user");
        location.reload();
      }, 2000);
    }
  }, SESSION_TIMEOUT);
}

// Réinitialiser le timer à chaque interaction
document.addEventListener("click",     ()=>resetSessionTimer(), true);
document.addEventListener("keydown",   ()=>resetSessionTimer(), true);
document.addEventListener("mousemove", ()=>resetSessionTimer(), true);

/* ─── ARCHIVAGE DOSSIERS ─── */
function archiverAnciensDossiers(){
  const limite = new Date();
  limite.setFullYear(limite.getFullYear() - 1);
  const aArchiver = dossiers.filter(d=>{
    if(d.statut !== "Facturé") return false;
    const dt = new Date(d.dateCreation||"");
    return dt < limite;
  });
  if(!aArchiver.length){ toast("Aucun dossier à archiver (facturés de plus d'1 an)"); return; }
  confirmerAction(`Archiver ${aArchiver.length} dossier${aArchiver.length>1?"s":""} facturés de plus d'un an ? Ils seront masqués mais conservés.`, ()=>{
    aArchiver.forEach(d=>{ d.archive = true; });
    saveData();
    renderDossiers();
    majDashboard();
    toast(`${aArchiver.length} dossier${aArchiver.length>1?"s":""} archivé${aArchiver.length>1?"s":""} ✓`);
  });
}

function toggleArchives(){
  const btn = document.getElementById("btnToggleArchives");
  const show = btn?.dataset.show !== "true";
  if(btn){ btn.dataset.show = show; btn.textContent = show ? "🗃 Masquer les archives" : "🗃 Afficher les archives"; }
  window._afficherArchives = show;
  renderDossiers();
}

/* ─── ASSOCIER EMAIL GOOGLE AUX UTILISATEURS ─── */
function associerEmailGoogle(indexUser){
  const users = getUtilisateurs();
  const u = users[indexUser];
  if(!u) return;
  ouvrirModal(`🔗 Associer Google — ${u.nom}`, `
    <div style="display:flex;flex-direction:column;gap:12px;">
      <p style="font-size:13px;color:var(--muted);">Saisissez l'adresse Gmail de cet utilisateur. Il pourra alors se connecter avec Google sans mot de passe.</p>
      <input type="email" id="gg_email" value="${escHtml(u.googleEmail||"")}" placeholder="utilisateur@gmail.com" style="width:100%;">
    </div>`,
    function(){
      const email = document.getElementById("gg_email")?.value.trim();
      users[indexUser].googleEmail = email;
      saveUtilisateurs(users);
      renderAdministration();
      toast(email ? `Email Google associé : ${email} ✓` : "Association supprimée");
    }
  );
  setTimeout(()=>{const btn=document.getElementById("modalBtnOk");if(btn){btn.textContent="🔗 Associer";}},50);
}

/* ─── ACOMPTE SUR DEVIS ─── */
function ajouterLigneAcompte(){
  const total = lignesDocument.reduce((a,l)=>{ const ht=l.qte*l.prixHT; return a+ht+ht*(l.tva/100); }, 0);
  if(total <= 0){ toast("Ajoutez d'abord des lignes au document","error"); return; }
  ouvrirModal("💰 Ajouter un acompte", `
    <div style="display:flex;flex-direction:column;gap:12px;">
      <p style="font-size:13px;color:var(--muted);">Total document : <b>${total.toLocaleString("fr-FR",{minimumFractionDigits:2})} €</b></p>
      <div style="display:flex;gap:10px;flex-wrap:wrap;">
        <button onclick="document.getElementById('ac_pct').value=25;calcAcompte(${total})" style="background:#334155;padding:6px 12px;font-size:12px;">25%</button>
        <button onclick="document.getElementById('ac_pct').value=30;calcAcompte(${total})" style="background:#334155;padding:6px 12px;font-size:12px;">30%</button>
        <button onclick="document.getElementById('ac_pct').value=50;calcAcompte(${total})" style="background:#334155;padding:6px 12px;font-size:12px;">50%</button>
      </div>
      <div style="display:flex;gap:10px;align-items:center;">
        <input type="number" id="ac_pct" placeholder="%" min="1" max="100" oninput="calcAcompte(${total})" style="width:80px;"> %
        <span style="color:var(--muted);">→</span>
        <input type="number" id="ac_montant" placeholder="Montant €" step="0.01" style="flex:1;">
      </div>
    </div>`,
    function(){
      const montant = parseFloat(document.getElementById("ac_montant")?.value||"0");
      if(!montant || montant<=0){ toast("Montant invalide","error"); return false; }
      // Ajouter ligne acompte (montant négatif = déduction)
      lignesDocument.push({ design:"Acompte versé", qte:1, prixHT:-montant, tva:0, type:"acompte" });
      renderLignes();
      toast(`Acompte de ${montant.toLocaleString("fr-FR",{minimumFractionDigits:2})} € ajouté ✓`);
    }
  );
  setTimeout(()=>{const btn=document.getElementById("modalBtnOk");if(btn)btn.textContent="✅ Ajouter l'acompte";},50);
}

function calcAcompte(total){
  const pct = parseFloat(document.getElementById("ac_pct")?.value||"0");
  const el  = document.getElementById("ac_montant");
  if(el && pct>0) el.value = (total*pct/100).toFixed(2);
}

/* ─── AVOIR / NOTE DE CRÉDIT ─── */
function creerAvoir(indexDoc){
  const doc = documents[indexDoc];
  if(!doc){ toast("Document introuvable","error"); return; }
  confirmerAction(`Créer un avoir (note de crédit) pour ${doc.id} — ${doc.totalTTC.toLocaleString("fr-FR",{minimumFractionDigits:2})} € ?`, ()=>{
    const avoir = {
      id: "AV-"+doc.id,
      type: "avoir",
      titre: "Avoir sur "+doc.id,
      date: new Date().toISOString().split("T")[0],
      dossierIdx: doc.dossierIdx,
      dossierNumero: doc.dossierNumero,
      lignes: doc.lignes.map(l=>({...l, prixHT:-Math.abs(l.prixHT)})),
      totalHT:  -doc.totalHT,
      totalTVA: -doc.totalTVA,
      totalTTC: -doc.totalTTC,
      refDoc: doc.id
    };
    documents.push(avoir);
    localStorage.setItem("documents", JSON.stringify(documents));
    renderDocuments();
    toast("Avoir créé : "+avoir.id+" ✓");
  });
}

/* ─── RAPPORT MENSUEL dans le menu ─── */
/* Appeler depuis sidebar */

/* ─── INJECTER RAPPORT + ARCHIVAGE + ACOMPTE DANS L'INTERFACE ─── */
document.addEventListener("DOMContentLoaded", ()=>{
  resetSessionTimer();

  // Ajouter bouton rapport mensuel dans le menu outils
  const nav = document.querySelector(".sidebar nav");
  if(nav){
    const lien = document.createElement("a");
    lien.href = "#";
    lien.onclick = ()=>{ genererRapportMensuel(); return false; };
    lien.textContent = "📄 Rapport mensuel";
    nav.appendChild(lien);

    const lienArch = document.createElement("a");
    lienArch.href = "#";
    lienArch.onclick = ()=>{ archiverAnciensDossiers(); return false; };
    lienArch.textContent = "🗃 Archiver (1 an+)";
    nav.appendChild(lienArch);
  }
});

