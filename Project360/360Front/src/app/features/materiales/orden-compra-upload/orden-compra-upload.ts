import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import {
  OrdenCompraService,
  DocumentoMaterialesResponse,
  MaterialDetectado
} from '../../../core/services/registro-compra/orden-compra';

@Component({
  selector: 'app-orden-compra-upload',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: './orden-compra-upload.html',
  styleUrls: ['./orden-compra-upload.css']
})
export class OrdenCompraUpload {
  selectedFile: File | null = null;
  isDragging = false;
  loading = false;

  errorMessage = '';
  successMessage = '';

  responseData: DocumentoMaterialesResponse | null = null;
  materialesDetectados: MaterialDetectado[] = [];

  private readonly maxFileSize = 10 * 1024 * 1024;

  private readonly allowedTypes = [
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp'
  ];

  private readonly allowedExtensions = ['pdf', 'jpg', 'jpeg', 'png', 'webp'];

  constructor(
    private ordenCompraService: OrdenCompraService,
    private router: Router
  ) {}

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragging = true;
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.isDragging = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragging = false;

    const file = event.dataTransfer?.files?.[0];

    if (file) {
      this.validarArchivo(file);
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (file) {
      this.validarArchivo(file);
    }
  }

  validarArchivo(file: File): void {
    this.errorMessage = '';
    this.successMessage = '';
    this.responseData = null;
    this.materialesDetectados = [];

    const extension = file.name.split('.').pop()?.toLowerCase();

    if (!extension || !this.allowedExtensions.includes(extension)) {
      this.errorMessage = 'Formato no permitido. Solo PDF, JPG, JPEG, PNG o WEBP.';
      this.selectedFile = null;
      return;
    }

    if (!this.allowedTypes.includes(file.type)) {
      this.errorMessage = 'Formato no permitido. Solo PDF, JPG, JPEG, PNG o WEBP.';
      this.selectedFile = null;
      return;
    }

    if (file.size > this.maxFileSize) {
      this.errorMessage = 'El archivo no puede superar los 10 MB.';
      this.selectedFile = null;
      return;
    }

    this.selectedFile = file;
  }

  subirArchivo(): void {
    if (!this.selectedFile) {
      this.errorMessage = 'Debe adjuntar un archivo.';
      return;
    }

    this.loading = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.responseData = null;
    this.materialesDetectados = [];

    this.ordenCompraService.subirDocumento(this.selectedFile).subscribe({
      next: (response) => {
        this.loading = false;
        this.responseData = response;
        this.materialesDetectados = response.data?.materiales || [];
        this.successMessage = response.message || 'Documento procesado correctamente.';
      },
      error: (error) => {
        this.loading = false;
        this.errorMessage =
          error?.error?.message || 'Error al procesar documento de materiales.';
      }
    });
  }

  quitarArchivo(): void {
    this.selectedFile = null;
    this.errorMessage = '';
    this.successMessage = '';
    this.responseData = null;
    this.materialesDetectados = [];
  }

  cancelar(): void {
    this.router.navigate(['/materiales']);
  }

  formatFileSize(size: number): string {
    return `${(size / 1024 / 1024).toFixed(2)} MB`;
  }
}
