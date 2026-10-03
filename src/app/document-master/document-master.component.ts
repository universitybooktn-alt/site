import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CartService } from '../services/cart.service';
import { CategorieMaster, DocumentsMasterService, FicheMaster } from '../services/documents-master.service';

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
export class DocumentMasterComponent implements OnInit {
  categories: CategorieMaster[] = [];
  fiches: FicheMaster[] = [];
  chargement = true;
  erreur = false;

  catActive = '';
  sousCatActive = '';
  filtreAnnee = '';
  recherche = '';
  page = 1;
  readonly parPage = 30;

  /** Fiche ajoutée à l'instant — animation « Ajouté ✓ » du bouton. */
  ajouteId: string | null = null;

  constructor(
    private service: DocumentsMasterService,
    private cartService: CartService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    this.chargement = true;
    this.erreur = false;
    this.service.lister().subscribe({
      next: res => {
        this.categories = res.categories || [];
        this.fiches = res.fiches || [];
        this.catActive = this.categoriesRacine[0]?.id || '';
        this.chargement = false;
      },
      error: () => { this.erreur = true; this.chargement = false; }
    });
  }

  get categoriesRacine(): CategorieMaster[] {
    return this.categories.filter(c => !c.parent);
  }

  sousCategoriesDe(catId: string): CategorieMaster[] {
    return this.categories.filter(c => c.parent === catId);
  }

  nomCategorie(id: string): string {
    return this.categories.find(c => c.id === id)?.nom || '';
  }

  compte(catId: string, sousCatId = ''): number {
    return this.fiches.filter(f => f.categorie === catId && (!sousCatId || f.sousCategorie === sousCatId)).length;
  }

  choisirCategorie(id: string): void {
    this.catActive = id;
    this.sousCatActive = '';
    this.reinitPage();
  }

  choisirSousCategorie(id: string): void {
    this.sousCatActive = id;
    this.reinitPage();
  }

  private get fichesCategorie(): FicheMaster[] {
    return this.fiches.filter(f =>
      (!this.catActive || f.categorie === this.catActive) &&
      (!this.sousCatActive || f.sousCategorie === this.sousCatActive));
  }

  get annees(): string[] {
    return [...new Set(this.fichesCategorie.map(f => f.annee).filter(Boolean))].sort().reverse();
  }

  get fichesFiltrees(): FicheMaster[] {
    const q = this.recherche.trim().toLowerCase();
    return this.fichesCategorie.filter(f =>
      (!this.filtreAnnee || f.annee === this.filtreAnnee) &&
      (!q || f.titre.toLowerCase().includes(q) || (f.auteur || '').toLowerCase().includes(q) || String(f.numero) === q));
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.fichesFiltrees.length / this.parPage));
  }

  get fichesPage(): FicheMaster[] {
    const debut = (this.page - 1) * this.parPage;
    return this.fichesFiltrees.slice(debut, debut + this.parPage);
  }

  reinitPage(): void {
    this.page = 1;
    if (this.filtreAnnee && !this.annees.includes(this.filtreAnnee)) this.filtreAnnee = '';
  }

  allerPage(p: number): void {
    this.page = Math.min(Math.max(1, p), this.totalPages);
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
