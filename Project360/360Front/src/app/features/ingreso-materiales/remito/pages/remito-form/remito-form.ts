import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';

import { RegistroCompraService } from '../../../../../core/services/registro-compra/registro-compra';
import { RemitoImportResponse, Remitos } from '../../../../../core/services/remitos';
import { DetalleRegistroCompra, RegistroCompra } from '../../../../../shared/interfaces/RegistroDeCompra.interface';

@Component({
  selector: 'app-remito-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatSnackBarModule,
    MatTooltipModule
  ],
  templateUrl: './remito-form.html',
  styleUrl: './remito-form.css',
})
export class RemitoForm implements OnInit {
  form!: FormGroup;
  materialManualForm!: FormGroup;
  registrosCompra: RegistroCompra[] = [];
  registroCompraSeleccionado: RegistroCompra | null = null;
  detalleRegistroCompra: DetalleRegistroCompra[] = [];
  idRegistroCompraFijo: number | null = null;
  guardando = false;
  importando = false;
  archivoSeleccionado: File | null = null;
  advertencias: string[] = [];

  formatosPermitidos = [
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp'
  ];

  maxSizeBytes = 10 * 1024 * 1024;

  constructor(
    private fb: FormBuilder,
    private registroCompraService: RegistroCompraService,
    private remitosService: Remitos,
    private route: ActivatedRoute,
    private router: Router,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.inicializarFormulario();
    this.cargarRegistrosCompra();

    const idRegistroCompra = this.route.snapshot.paramMap.get('id');

    if (idRegistroCompra) {
      this.idRegistroCompraFijo = Number(idRegistroCompra);
      this.form.patchValue({ idRegistroCompra: this.idRegistroCompraFijo });
      this.form.get('idRegistroCompra')?.disable({ emitEvent: false });
      this.cargarDetalleRegistroCompra(this.idRegistroCompraFijo);
    }

    this.form.get('idRegistroCompra')?.valueChanges.subscribe(id => {
      this.detalle.clear();
      this.detalleRegistroCompra = [];

      if (id) {
        this.cargarDetalleRegistroCompra(Number(id));
      }
    });
  }

  inicializarFormulario(): void {
    this.form = this.fb.group({
      numero: ['', Validators.required],
      fecha: ['', Validators.required],
      idRegistroCompra: [null, Validators.required],
      detalle: this.fb.array([])
    });

    this.materialManualForm = this.fb.group({
      idMaterial: [null, Validators.required],
      cantidad: [null, [Validators.required, Validators.min(0.01)]],
      unidad: ['', Validators.required]
    });
  }

  get detalle(): FormArray {
    return this.form.get('detalle') as FormArray;
  }

  get materialesDisponibles(): DetalleRegistroCompra[] {
    const idsCargados = new Set(
      this.detalle.controls
        .map(control => Number(control.get('idMaterial')?.value))
        .filter(id => !!id)
    );

    return this.detalleRegistroCompra.filter(item =>
      !!item.idMaterial && !idsCargados.has(Number(item.idMaterial))
    );
  }

  cargarRegistrosCompra(): void {
    this.registroCompraService.getRegistros().subscribe({
      next: registros => {
        this.registrosCompra = registros.filter(registro =>
          ['CREADA', 'PARCIAL', 'PARCIAL CON DEMORAS'].includes(this.getEstadoRegistro(registro))
          && registro.activo !== false
        );

        if (this.idRegistroCompraFijo) {
          this.registroCompraSeleccionado =
            registros.find(registro => registro.idRegistroCompra === this.idRegistroCompraFijo) ?? null;
        }
      },
      error: error => {
        this.snackBar.open(error?.error?.message || 'Error al cargar registros de compra.', 'Cerrar', {
          duration: 3500
        });
      }
    });
  }

  getEstadoRegistro(registro: RegistroCompra): string {
    return (registro.estado?.codigo || registro.estado?.nombre || '')
      .toString()
      .trim()
      .toUpperCase();
  }

  cargarDetalleRegistroCompra(id: number): void {
    this.registroCompraService.getRegistroById(id).subscribe({
      next: registro => {
        this.detalleRegistroCompra = registro.detalle ?? [];
        this.detalle.clear();
        this.materialManualForm.reset({
          idMaterial: null,
          cantidad: null,
          unidad: ''
        });
      },
      error: error => {
        this.snackBar.open(error?.error?.message || 'Error al cargar detalle del registro.', 'Cerrar', {
          duration: 3500
        });
      }
    });
  }

  onMaterialManualChange(idMaterial: number): void {
    const material = this.buscarMaterialPorId(idMaterial);

    this.materialManualForm.patchValue({
      unidad: material?.unidad ?? ''
    });
  }

  agregarMaterialManual(): void {
    if (!this.form.getRawValue().idRegistroCompra) {
      this.snackBar.open('Selecciona un Registro de Compra antes de agregar materiales.', 'Cerrar', {
        duration: 3000
      });
      return;
    }

    if (this.materialManualForm.invalid) {
      this.materialManualForm.markAllAsTouched();
      this.snackBar.open('Completa material, cantidad y unidad.', 'Cerrar', {
        duration: 3000
      });
      return;
    }

    const value = this.materialManualForm.getRawValue();
    const material = this.buscarMaterialPorId(Number(value.idMaterial));

    if (!material) {
      this.snackBar.open('El material seleccionado no pertenece al Registro de Compra.', 'Cerrar', {
        duration: 3000
      });
      return;
    }

    this.detalle.push(this.crearDetalleItem(material, Number(value.cantidad), value.unidad));
    this.materialManualForm.reset({
      idMaterial: null,
      cantidad: null,
      unidad: ''
    });
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (file) {
      this.seleccionarArchivo(file);
    }

    input.value = '';
  }

  seleccionarArchivo(file: File): void {
    if (!this.validarArchivo(file)) {
      return;
    }

    this.archivoSeleccionado = file;
    this.advertencias = [];
  }

  validarArchivo(file: File): boolean {
    if (!this.formatosPermitidos.includes(file.type)) {
      this.snackBar.open('Formato no permitido. Usa PDF, JPG, JPEG, PNG o WEBP.', 'Cerrar', {
        duration: 3500
      });
      return false;
    }

    if (file.size > this.maxSizeBytes) {
      this.snackBar.open('El archivo supera el tamano maximo permitido de 10 MB.', 'Cerrar', {
        duration: 3500
      });
      return false;
    }

    return true;
  }

  importarDocumento(): void {
    if (!this.archivoSeleccionado) {
      this.snackBar.open('Selecciona un archivo para importar.', 'Cerrar', {
        duration: 3000
      });
      return;
    }

    this.importando = true;

    this.remitosService.importarDocumento(this.archivoSeleccionado).subscribe({
      next: response => {
        this.importando = false;

        if (!response.success) {
          this.snackBar.open(response.message || 'No se pudo procesar el documento.', 'Cerrar', {
            duration: 3500
          });
          return;
        }

        this.aplicarDatosImportados(response);

        this.snackBar.open('Documento procesado. Revisa los datos antes de guardar.', 'Cerrar', {
          duration: 4000
        });
      },
      error: error => {
        this.importando = false;
        this.snackBar.open(error?.error?.message || 'Error al procesar documento.', 'Cerrar', {
          duration: 4000
        });
      }
    });
  }

  aplicarDatosImportados(response: RemitoImportResponse): void {
    const data = response.data;

    this.form.patchValue({
      numero: data.remito?.numero ?? this.form.value.numero,
      fecha: this.normalizarFecha(data.remito?.fecha) || this.form.value.fecha
    });

    this.advertencias = [...(data.advertencias ?? [])];

    if (!this.form.getRawValue().idRegistroCompra) {
      this.advertencias.push('Selecciona un Registro de Compra para cruzar los materiales detectados.');
      return;
    }

    this.aplicarDetalleImportado(data.detalle ?? []);
  }

  aplicarDetalleImportado(detalleImportado: RemitoImportResponse['data']['detalle']): void {
    const sinCoincidencia: string[] = [];

    for (const item of detalleImportado) {
      const materialOc = this.buscarMaterialEnRegistroCompra(item.nombreMaterial);

      if (!materialOc) {
        sinCoincidencia.push(item.nombreMaterial);
        continue;
      }

      const index = this.buscarIndiceMaterialEnDetalle(materialOc);
      const cantidad = Number(item.cantidad || 0);
      const unidad = item.unidad || materialOc.unidad;

      if (index === -1) {
        this.detalle.push(this.crearDetalleItem(materialOc, cantidad, unidad));
        continue;
      }

      this.detalle.at(index).patchValue({ cantidad, unidad });
    }

    if (sinCoincidencia.length) {
      this.advertencias.push(
        `Materiales detectados que no pertenecen al Registro de Compra seleccionado: ${sinCoincidencia.join(', ')}`
      );
    }
  }

  buscarMaterialPorId(idMaterial: number): DetalleRegistroCompra | null {
    return this.detalleRegistroCompra.find(item => Number(item.idMaterial) === Number(idMaterial)) ?? null;
  }

  buscarMaterialEnRegistroCompra(nombreMaterial: string): DetalleRegistroCompra | null {
    const materialImportado = this.normalizarTexto(nombreMaterial);

    if (!materialImportado) {
      return null;
    }

    return this.detalleRegistroCompra.find(item => {
      const materialOc = this.normalizarTexto(item.nombreMaterial);
      return materialOc.includes(materialImportado) || materialImportado.includes(materialOc);
    }) ?? null;
  }

  buscarIndiceMaterialEnDetalle(material: DetalleRegistroCompra): number {
    return this.detalle.controls.findIndex(control => {
      const idControl = Number(control.get('idMaterial')?.value);
      const idMaterial = Number(material.idMaterial);
      const nombreControl = this.normalizarTexto(control.get('material')?.value);
      const nombreMaterial = this.normalizarTexto(material.nombreMaterial);

      return (!!idControl && idControl === idMaterial) || nombreControl === nombreMaterial;
    });
  }

  quitarMaterial(index: number): void {
    this.detalle.removeAt(index);
  }

  crearDetalleItem(item: DetalleRegistroCompra, cantidad: number | null = null, unidad?: string): FormGroup {
    return this.fb.group({
      idMaterial: [item.idMaterial],
      material: [item.nombreMaterial],
      cantidadSolicitada: [item.cantidadSolicitada ?? item.cantidad],
      cantidad: [cantidad, [Validators.required, Validators.min(0.01)]],
      unidad: [unidad || item.unidad, Validators.required]
    });
  }

  guardar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.snackBar.open('Completa los campos obligatorios.', 'Cerrar', { duration: 3000 });
      return;
    }

    const detalle = this.detalle.controls
      .map(control => control.value)
      .filter(item => Number(item.cantidad) > 0);

    if (detalle.length === 0) {
      this.snackBar.open('Carga al menos una cantidad recibida.', 'Cerrar', { duration: 3000 });
      return;
    }

    const rawValue = this.form.getRawValue();
    const payload = {
      numero: rawValue.numero,
      fecha: rawValue.fecha,
      registro_compra_id: rawValue.idRegistroCompra,
      detalle: detalle.map((item: any) => ({
        id_material: item.idMaterial,
        cantidad: Number(item.cantidad),
        UoM: item.unidad
      }))
    };

    this.guardando = true;

    this.remitosService.crearRemito(payload).subscribe({
      next: () => {
        this.guardando = false;
        this.snackBar.open('Remito creado correctamente. Queda pendiente de liberacion.', 'Cerrar', {
          duration: 3500
        });
        this.router.navigate(this.getRutaRetorno());
      },
      error: error => {
        this.guardando = false;
        this.snackBar.open(error?.error?.message || 'Error al guardar remito.', 'Cerrar', {
          duration: 4000
        });
      }
    });
  }

  cancelar(): void {
    this.router.navigate(this.getRutaRetorno());
  }

  getRutaRetorno(): any[] {
    return this.idRegistroCompraFijo
      ? ['/ingreso-materiales/registros', this.idRegistroCompraFijo, 'remitos']
      : ['/ingreso-materiales/remitos'];
  }

  normalizarFecha(fecha?: string | null): string {
    return fecha ? fecha.substring(0, 10) : '';
  }

  normalizarTexto(value?: string | null): string {
    return (value ?? '')
      .toString()
      .trim()
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '');
  }
}
