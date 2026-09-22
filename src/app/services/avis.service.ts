import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { OrderItem, InviteCommande } from './orders.service';

export interface AvisPublic {
  auteurNom: string;
  note: number;
  texte: string;
  createdAt: string;
}

export interface MonAvis {
  _id: string;
  document: { _id: string; titre: string; image: string } | null;
  note: number;
  texte: string;
  statut: 'en_attente' | 'approuve' | 'refuse';
  motifRefus: string;
  createdAt: string;
}

/**
 * Déblocage GRATUIT d'un document payant en laissant un avis, en alternative au paiement en
 * ligne Konnect (voir panier.component.ts#initierAvisDeblocage) — voir backend/controllers/avis.controller.js.
 * L'avis reste `en_attente` tant qu'un administrateur ne l'a pas approuvé : aucun accès n'est
 * donné avant validation.
 */
@Injectable({ providedIn: 'root' })
export class AvisService {
  private readonly apiUrl = `${environment.apiUrl}/avis`;

  constructor(private http: HttpClient) {}

  /** Avis approuvés d'un document — alimente l'onglet "Avis" de la fiche produit (public). */
  listApprouves(documentId: string): Observable<{ avis: AvisPublic[] }> {
    return this.http.get<{ avis: AvisPublic[] }>(`${this.apiUrl}/document/${documentId}`);
  }

  /** Même payload que OrdersService.create()/PaymentsService.initierKonnect(), plus le texte/la
   *  note de l'avis — réservé à un panier contenant UN SEUL document payant. */
  initierAvis(payload: {
    items: OrderItem[];
    total: number;
    paiement: string;
    adresseLivraison: string;
    gouvernorat?: string;
    delegation?: string;
    commentaire?: string;
    invite?: InviteCommande;
    avisTexte: string;
    avisNote: number;
  }): Observable<{ message: string; numero: string; jetonSuivi: string; avisId: string }> {
    return this.http.post<{ message: string; numero: string; jetonSuivi: string; avisId: string }>(
      `${this.apiUrl}/initier`, payload
    );
  }

  mesAvis(): Observable<{ avis: MonAvis[] }> {
    return this.http.get<{ avis: MonAvis[] }>(`${this.apiUrl}/mes-avis`);
  }
}
