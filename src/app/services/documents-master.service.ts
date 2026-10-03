import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

/** Catégorie (parent = null) ou sous-catégorie (parent = id de la catégorie). */
export interface CategorieMaster {
  id: string;
  nom: string;
  parent: string | null;
}

export interface FicheMaster {
  id: string;
  /** Id numérique (hash du _id) utilisé pour le panier / la commande. */
  produitId: number;
  categorie: string;
  sousCategorie: string;
  numero: number;
  titre: string;
  annee: string;
  auteur: string;
  nbPages: number;
  prix: number;
}

/** Fiches « Document Master » (exposés, mémoires, conférences…) gérées depuis la caisse —
 *  lecture seule, API publique (voir backend/controllers/documentsMaster.controller.js#listPublic). */
@Injectable({ providedIn: 'root' })
export class DocumentsMasterService {
  constructor(private http: HttpClient) {}

  lister(): Observable<{ categories: CategorieMaster[]; fiches: FicheMaster[] }> {
    return this.http.get<{ categories: CategorieMaster[]; fiches: FicheMaster[] }>(
      `${environment.apiUrl}/catalogue/documents-master`
    );
  }
}
