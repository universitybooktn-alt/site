import { Component, OnInit } from '@angular/core';
import { AdminAvisService, AvisAdmin, StatutAvis } from '../../services/admin-avis.service';

@Component({
  selector: 'app-admin-avis',
  templateUrl: './avis.component.html',
  styleUrls: ['./avis.component.css']
})
export class AvisComponent implements OnInit {
  avisListe: AvisAdmin[] = [];
  nbEnAttente = 0;
  chargement = true;
  erreur = '';
  message = '';

  filtreStatut: StatutAvis | '' = 'en_attente';

  // Actions en cours (anti double-clic) et modale de refus.
  actionEnCoursId: string | null = null;
  refusPour: AvisAdmin | null = null;
  motifRefus = '';

  constructor(private api: AdminAvisService) {}

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    this.chargement = true;
    this.erreur = '';
    this.api.list(this.filtreStatut).subscribe({
      next: res => {
        this.avisListe = res.avis || [];
        this.nbEnAttente = res.nbEnAttente || 0;
        this.chargement = false;
      },
      error: () => {
        this.erreur = 'Impossible de charger les avis.';
        this.chargement = false;
      }
    });
  }

  changerFiltre(statut: StatutAvis | ''): void {
    this.filtreStatut = statut;
    this.charger();
  }

  libelleStatut(s: StatutAvis): string {
    return s === 'approuve' ? 'Approuvé' : s === 'refuse' ? 'Refusé' : 'En attente';
  }

  approuver(a: AvisAdmin): void {
    if (this.actionEnCoursId) return;
    if (!confirm(`Approuver l'avis de « ${a.auteurNom || 'ce client'} » ? Le document « ${a.document?.titre || '?'} » sera accessible dans son espace.`)) return;
    this.actionEnCoursId = a._id;
    this.message = '';
    this.api.approuver(a._id).subscribe({
      next: res => {
        this.actionEnCoursId = null;
        this.message = res.message;
        this.appliquerMaj(res.avis);
      },
      error: err => {
        this.actionEnCoursId = null;
        this.erreur = err?.error?.message || "Erreur lors de l'approbation.";
      }
    });
  }

  ouvrirRefus(a: AvisAdmin): void {
    this.refusPour = a;
    this.motifRefus = '';
  }

  fermerRefus(): void {
    if (this.actionEnCoursId) return;
    this.refusPour = null;
  }

  confirmerRefus(): void {
    if (!this.refusPour || this.actionEnCoursId) return;
    const a = this.refusPour;
    this.actionEnCoursId = a._id;
    this.message = '';
    this.api.refuser(a._id, this.motifRefus.trim()).subscribe({
      next: res => {
        this.actionEnCoursId = null;
        this.refusPour = null;
        this.message = res.message;
        this.appliquerMaj(res.avis);
      },
      error: err => {
        this.actionEnCoursId = null;
        this.erreur = err?.error?.message || 'Erreur lors du refus.';
      }
    });
  }

  /** Remplace l'avis mis à jour dans la liste, ou le retire si celui-ci ne correspond plus au
   *  filtre courant ; recale le compteur « en attente ». */
  private appliquerMaj(maj: AvisAdmin): void {
    this.nbEnAttente = this.avisListe.filter(x => x._id !== maj._id && x.statut === 'en_attente').length
      + (maj.statut === 'en_attente' ? 1 : 0);
    if (this.filtreStatut && maj.statut !== this.filtreStatut) {
      this.avisListe = this.avisListe.filter(x => x._id !== maj._id);
      return;
    }
    const idx = this.avisListe.findIndex(x => x._id === maj._id);
    if (idx >= 0) this.avisListe[idx] = maj;
  }

  trackById(_i: number, item: AvisAdmin): string {
    return item._id;
  }
}
