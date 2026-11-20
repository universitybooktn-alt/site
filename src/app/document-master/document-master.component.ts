import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CartService } from '../services/cart.service';
import { CategorieMaster, DocumentsMasterService, FicheMaster } from '../services/documents-master.service';

export type TriDoc = 'defaut' | 'annee' | 'prixAsc' | 'prixDesc' | 'titre';

export interface FiltreActif {
  cle: 'cat' | 'type' | 'annee' | 'q';
  libelle?: string;
  cleLibelle?: string;
  icone: string;
}

/**
 * Page « Document Master » du site : catalogue des fiches gérées depuis la caisse (page Document
 * Master), classées par catégorie (ex. Droit) et sous-catégorie (ex. Mémoire), avec ajout au panier
 * et commande directe. Déclaré dans AppModule (qui fournit les pipes `translate` et `ngModel`).
 */
@Component({
  selector: 'app-document-master',
  templateUrl: './document-master.component.html',
  styleUrls: ['./document-master.component.css']
})
export class DocumentMasterComponent implements OnInit, OnDestroy {
  categories: CategorieMaster[] = [];
  fiches: FicheMaster[] = [];
  chargement = true;
  erreur = false;

  catActive = '';
  sousCatActive = '';
  filtreAnnee = '';
  /** Valeur appliquée (après debounce) ; `rechercheSaisie` est liée au champ. */
  recherche = '';
  rechercheSaisie = '';
  tri: TriDoc = 'defaut';
  page = 1;
  readonly parPage = 30;

  /** Panneau de filtres déplié (mobile uniquement). */
  panneauOuvert = false;
  /** Nombre de filtres actifs contenus dans le panneau (hors recherche) — badge du bouton « Filtres ». */
  nbFiltresPanneau = 0;

  /** Résultats mis en cache : recalculés uniquement quand un filtre change. */
  fichesFiltrees: FicheMaster[] = [];
  fichesPage: FicheMaster[] = [];
  totalPages = 1;
  annees: string[] = [];
  sousCategories: CategorieMaster[] = [];
  filtresActifs: FiltreActif[] = [];
  categoriesRacine: CategorieMaster[] = [];
  readonly tris: { id: TriDoc; cle: string }[] = [
    { id: 'defaut', cle: 'documentMaster.fSortDefault' },
    { id: 'annee', cle: 'documentMaster.fSortYear' },
    { id: 'prixAsc', cle: 'documentMaster.fSortPriceAsc' },
    { id: 'prixDesc', cle: 'documentMaster.fSortPriceDesc' },
    { id: 'titre', cle: 'documentMaster.fSortTitle' }
  ];

  private catDefaut = '';
  private compteCat = new Map<string, number>();
  private compteSous = new Map<string, number>();
  private timerRecherche: any;

  /** Fiche ajoutée à l'instant — animation « Ajouté ✓ » du bouton. */
  ajouteId: string | null = null;

  constructor(
    private service: DocumentsMasterService,
    private cartService: CartService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.charger();
  }

  ngOnDestroy(): void {
    clearTimeout(this.timerRecherche);
  }

  charger(): void {
    this.chargement = true;
    this.erreur = false;
    this.service.lister().subscribe({
      next: res => {
        this.categories = res.categories || [];
        this.fiches = res.fiches || [];
        this.categoriesRacine = this.categories.filter(c => !c.parent);
        this.catDefaut = ''; // catégorie par défaut : « Tous »
        this.catActive = this.catDefaut;
        this.lireUrl();
        this.chargement = false;
        this.recalculer();
      },
      error: () => { this.erreur = true; this.chargement = false; }
    });
  }

  /** Restaure les filtres depuis l'URL (lien partageable / retour navigateur). */
  private lireUrl(): void {
    const p = this.route.snapshot.queryParamMap;
    const cat = p.get('cat');
    if (cat === 'all') this.catActive = '';
    else if (cat && this.categoriesRacine.some(c => c.id === cat)) this.catActive = cat;
    const type = p.get('type');
    if (type && this.categories.some(c => c.id === type && c.parent === this.catActive)) this.sousCatActive = type;
    this.filtreAnnee = p.get('annee') || '';
    this.recherche = this.rechercheSaisie = p.get('q') || '';
    const tri = p.get('tri') as TriDoc;
    if (this.tris.some(t => t.id === tri)) this.tri = tri;
  }

  private ecrireUrl(): void {
    const qp: any = {
      cat: this.catActive === this.catDefaut ? null : (this.catActive || 'all'),
      type: this.sousCatActive || null,
      annee: this.filtreAnnee || null,
      q: this.recherche.trim() || null,
      tri: this.tri === 'defaut' ? null : this.tri
    };
    this.router.navigate([], { relativeTo: this.route, queryParams: qp, queryParamsHandling: 'merge', replaceUrl: true });
  }

  sousCategoriesDe(catId: string): CategorieMaster[] {
    return this.categories.filter(c => c.parent === catId);
  }

  nomCategorie(id: string): string {
    return this.categories.find(c => c.id === id)?.nom || '';
  }

  /** Nombre de fiches (tenant compte de la recherche et de l'année actives). */
  compte(catId: string, sousCatId = ''): number {
    if (!catId) return this.compteCat.get('') || 0;
    return sousCatId ? (this.compteSous.get(catId + '|' + sousCatId) || 0) : (this.compteCat.get(catId) || 0);
  }

  /** Recalcule en une passe : compteurs, années, liste filtrée triée, pagination, filtres actifs. */
  private recalculer(): void {
    const q = this.recherche.trim().toLowerCase();
    const matchQ = (f: FicheMaster) => !q || f.titre.toLowerCase().includes(q) ||
      (f.auteur || '').toLowerCase().includes(q) || String(f.numero) === q;

    this.sousCategories = this.catActive ? this.sousCategoriesDe(this.catActive) : [];
    if (this.sousCatActive && !this.sousCategories.some(s => s.id === this.sousCatActive)) this.sousCatActive = '';

    const anneesSet = new Set<string>();
    const cCat = new Map<string, number>();
    const cSous = new Map<string, number>();
    const res: FicheMaster[] = [];
    let total = 0;

    for (const f of this.fiches) {
      const okCat = !this.catActive || f.categorie === this.catActive;
      const okSous = !this.sousCatActive || f.sousCategorie === this.sousCatActive;
      if (okCat && okSous && f.annee) anneesSet.add(f.annee);
      if (!matchQ(f) || (this.filtreAnnee && f.annee !== this.filtreAnnee)) continue;
      total++;
      cCat.set(f.categorie, (cCat.get(f.categorie) || 0) + 1);
      if (f.categorie === this.catActive) cSous.set(f.categorie + '|' + f.sousCategorie, (cSous.get(f.categorie + '|' + f.sousCategorie) || 0) + 1);
      if (okCat && okSous) res.push(f);
    }
    cCat.set('', total);

    this.annees = [...anneesSet].sort().reverse();
    if (this.filtreAnnee && !anneesSet.has(this.filtreAnnee)) {
      // l'année n'existe plus dans cette sélection : on la retire et on relance
      this.filtreAnnee = '';
      return this.recalculer();
    }
    this.compteCat = cCat;
    this.compteSous = cSous;

    switch (this.tri) {
      case 'annee': res.sort((a, b) => (b.annee || '').localeCompare(a.annee || '')); break;
      case 'prixAsc': res.sort((a, b) => a.prix - b.prix); break;
      case 'prixDesc': res.sort((a, b) => b.prix - a.prix); break;
      case 'titre': res.sort((a, b) => a.titre.localeCompare(b.titre, undefined, { sensitivity: 'base' })); break;
    }
    this.fichesFiltrees = res;
    this.totalPages = Math.max(1, Math.ceil(res.length / this.parPage));
    this.page = Math.min(this.page, this.totalPages);
    const debut = (this.page - 1) * this.parPage;
    this.fichesPage = res.slice(debut, debut + this.parPage);

    const actifs: FiltreActif[] = [];
    if (this.catActive !== this.catDefaut) {
      actifs.push(this.catActive
        ? { cle: 'cat', libelle: this.nomCategorie(this.catActive), icone: 'fa-folder' }
        : { cle: 'cat', cleLibelle: 'documentMaster.fAllCategories', icone: 'fa-folder' });
    }
    if (this.sousCatActive) actifs.push({ cle: 'type', libelle: this.nomCategorie(this.sousCatActive), icone: 'fa-tag' });
    if (this.filtreAnnee) actifs.push({ cle: 'annee', libelle: this.filtreAnnee, icone: 'fa-calendar' });
    if (this.recherche.trim()) actifs.push({ cle: 'q', libelle: '« ' + this.recherche.trim() + ' »', icone: 'fa-magnifying-glass' });
    this.filtresActifs = actifs;
    this.nbFiltresPanneau = actifs.filter(f => f.cle !== 'q').length + (this.tri !== 'defaut' ? 1 : 0);
  }

  /** Applique un changement de filtre : retour page 1, recalcul, mise à jour de l'URL. */
  private appliquer(resetPage = true): void {
    if (resetPage) this.page = 1;
    this.recalculer();
    this.ecrireUrl();
  }

  choisirCategorie(id: string): void {
    this.catActive = id;
    this.sousCatActive = '';
    this.appliquer();
  }

  choisirSousCategorie(id: string): void {
    this.sousCatActive = id;
    this.appliquer();
  }

  changerAnnee(a: string): void {
    this.filtreAnnee = a;
    this.appliquer();
  }

  changerTri(t: TriDoc): void {
    this.tri = t;
    this.appliquer();
  }

  /** Recherche avec debounce pour rester fluide sur de grandes listes. */
  surSaisie(v: string): void {
    this.rechercheSaisie = v;
    clearTimeout(this.timerRecherche);
    this.timerRecherche = setTimeout(() => { this.recherche = v; this.appliquer(); }, 200);
  }

  effacerRecherche(): void {
    clearTimeout(this.timerRecherche);
    this.rechercheSaisie = this.recherche = '';
    this.appliquer();
  }

  retirerFiltre(f: FiltreActif): void {
    if (f.cle === 'cat') { this.catActive = this.catDefaut; this.sousCatActive = ''; }
    else if (f.cle === 'type') this.sousCatActive = '';
    else if (f.cle === 'annee') this.filtreAnnee = '';
    else { clearTimeout(this.timerRecherche); this.rechercheSaisie = this.recherche = ''; }
    this.appliquer();
  }

  reinitialiserFiltres(): void {
    clearTimeout(this.timerRecherche);
    this.catActive = this.catDefaut;
    this.sousCatActive = '';
    this.filtreAnnee = '';
    this.rechercheSaisie = this.recherche = '';
    this.tri = 'defaut';
    this.appliquer();
  }

  allerPage(p: number): void {
    this.page = Math.min(Math.max(1, p), this.totalPages);
    this.recalculer();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /** Ajoute la fiche au panier (photocopie livrée ou retirée en magasin) — le prix est revérifié
   *  par le serveur à la commande (orderPricing.service.js#trouverFicheMaster). */
  ajouterPanier(f: FicheMaster, ouvrirTiroir = true): void {
    const sousCat = this.nomCategorie(f.sousCategorie);
    this.cartService.ajouter({
      id: f.produitId,
      produitId: f.produitId,
      titre: f.titre,
      categorie: sousCat || this.nomCategorie(f.categorie) || 'Document Master',
      prix: f.prix,
      icone: 'fa-graduation-cap',
      type: 'document master',
      auteur: f.auteur,
      estDocument: false
    });
    if (!ouvrirTiroir) this.cartService.fermerPanier();
    this.ajouteId = f.id;
    setTimeout(() => { if (this.ajouteId === f.id) this.ajouteId = null; }, 1600);
  }

  /** Commander directement : ajoute la fiche puis ouvre le tunnel de commande du panier. */
  commander(f: FicheMaster): void {
    this.ajouterPanier(f, false);
    this.router.navigate(['/panier'], { queryParams: { checkout: 1 } });
  }

  formatPrix(v: number): string {
    return (Number(v) || 0).toFixed(3).replace('.', ',') + ' د.ت';
  }

  trackById(_i: number, x: { id: string }): string { return x.id; }
}
