import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export type StatutAvis = 'en_attente' | 'approuve' | 'refuse';

export interface AvisAdmin {
  _id: string;
  document: { _id: string; titre: string; image: string } | null;
  commande: string;
  user: string | null;
  auteurNom: string;
  auteurEmail: string;
  note: number;
  texte: string;
  statut: StatutAvis;
  motifRefus: string;
  traitePar: string;
  traiteLe?: string;
  createdAt: string;
}

export interface AvisAdminResponse {
  avis: AvisAdmin[];
  nbEnAttente: number;
}

/**
 * Avis débloquant un document payant (Admin > Avis à valider). L'approbation finalise la
 * commande "En attente" associée — voir backend/controllers/avis.controller.js.
 */
@Injectable({ providedIn: 'root' })
export class AdminAvisService {
  private readonly apiUrl = `${environment.apiUrl}/admin/avis`;

  constructor(private http: HttpClient) {}

  list(statut?: StatutAvis | ''): Observable<AvisAdminResponse> {
    let params = new HttpParams();
    if (statut) params = params.set('statut', statut);
    return this.http.get<AvisAdminResponse>(this.apiUrl, { params });
  }

  approuver(id: string): Observable<{ message: string; avis: AvisAdmin }> {
    return this.http.post<{ message: string; avis: AvisAdmin }>(`${this.apiUrl}/${id}/approuver`, {});
  }

  refuser(id: string, motif: string): Observable<{ message: string; avis: AvisAdmin }> {
    return this.http.post<{ message: string; avis: AvisAdmin }>(`${this.apiUrl}/${id}/refuser`, { motif });
  }
}
