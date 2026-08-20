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
import { DetalleRemito, RemitoImportResponse, Remitos } from '../../../../../core/services/remitos';
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
  remitoId: number | null = null;
  esEdicion = false;
  cargando = false;
  guardando = false;
  importando = false;
  archivoSeleccionado: File | null = null;
  advertencias: string[] = [];
  cantidadesOriginalesEdicion = new Map<number, number>();

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

    const remitoIdParam = this.route.snapshot.paramMap.get('remitoId');
    this.esEdicion = this.route.snapshot.url.some(segment => segment.path === 'editar');
    this.remitoId = this.esEdicion
      ? Number(remitoIdParam || this.route.snapshot.paramMap.get('id'))
      : null;
    const esContextoRegistro = this.route.snapshot.url.some(segment => segment.path === 'registros')
      && this.route.snapshot.url.some(segment => segment.path === 'remitos');
    const idRegistroCompra = esContextoRegistro ? this.route.snapshot.paramMap.get('id') : null;

    if (idRegistroCompra) {
      this.idRegistroCompraFijo = Number(idRegistroCompra);
      this.form.patchValue({ idRegistroCompra: this.idRegistroCompraFijo });
      this.form.get('idRegistroCompra')?.disable({ emitEvent: false });
    }

    if (this.remitoId) {
      this.cargarRemitoParaEditar(this.remitoId);
    } else if (this.idRegistroCompraFijo) {
      this.cargarDetalleRegistroCompra(this.idRegistroCompraFijo);
    }

    this.form.get('idRegistroCompra')?.valueChanges.subscribe(id => {
      this.detalle.clear();
      this.detalleRegistroCompra = [];
      this.registroCompraSeleccionado = id
        ? this.registrosCompra.find(registro => Number(registro.idRegistroCompra) === Number(id)) ?? null
        : null;

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
      idDetalle: [null, Validators.required],
      cantidad: [null, [Validators.required, Validators.min(0.01)]],
      unidad: ['', Validators.required]
    });
  }

  get detalle(): FormArray {
    return this.form.get('detalle') as FormArray;
  }

  get documentoAsociadoLabel(): string {
    if (!this.registroCompraSeleccionado) return 'Cargando documento asociado...';
    const tipo = String(this.registroCompraSeleccionado.tipo || '').trim().toUpperCase();
    const numero = String(this.registroCompraSeleccionado.numero || '').trim();
    return [tipo, numero].filter(Boolean).join(' ') || 'Documento sin número';
  }

  get materialesDisponibles(): DetalleRegistroCompra[] {
    const idsCargados = new Set(
      this.detalle.controls
        .map(control => Number(control.get('idDetalle')?.value))
        .filter(id => !!id)
    );

    return this.detalleRegistroCompra.filter(item =>
      !!item.idDetalle && !idsCargados.has(Number(item.idDetalle))
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
            registros.find(registro => Number(registro.idRegistroCompra) === Number(this.idRegistroCompraFijo)) ?? null;
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

  cargarDetalleRegistroCompra(id: number, detalleRemito?: DetalleRemito[]): void {
    this.registroCompraService.getRegistroById(id).subscribe({
      next: registro => {
        this.registroCompraSeleccionado = registro;
        this.detalleRegistroCompra = registro.detalle ?? [];
        this.detalle.clear();
        if (detalleRemito?.length) {
          this.cargarDetalleRemitoEnFormulario(detalleRemito);
        }
        this.materialManualForm.reset({
          idDetalle: null,
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

  cargarRemitoParaEditar(remitoId: number): void {
    this.cargando = true;
    this.remitosService.getRemitoById(remitoId).subscribe({
      next: remito => {
        this.cargando = false;
        const estado = remito.estadoLiberacion || (remito.liberado ? 'LIBERADO' : 'PENDIENTE');
        if (estado !== 'PENDIENTE') {
          this.snackBar.open('No se puede modificar un remito que ya tiene liberaciones.', 'Cerrar', { duration: 4500 });
          this.router.navigate(this.getRutaRetorno());
          return;
        }

        this.idRegistroCompraFijo = Number(remito.idRegistroCompra);
        this.form.patchValue({
          numero: remito.numero,
          fecha: this.normalizarFecha(remito.fecha),
          idRegistroCompra: this.idRegistroCompraFijo
        }, { emitEvent: false });
        this.form.get('idRegistroCompra')?.disable({ emitEvent: false });
        this.cargarDetalleRegistroCompra(this.idRegistroCompraFijo, remito.detalle ?? []);
      },
      error: error => {
        this.cargando = false;
        this.snackBar.open(error?.error?.message || 'No se pudo cargar el remito.', 'Cerrar', { duration: 4000 });
      }
    });
  }

  cargarDetalleRemitoEnFormulario(detalleRemito: DetalleRemito[]): void {
    this.cantidadesOriginalesEdicion.clear();
    for (const item of detalleRemito) {
      const materialOc = this.detalleRegistroCompra.find(material =>
        this.normalizarTexto(material.nombreMaterial) === this.normalizarTexto(item.material)
        && this.normalizarTexto(material.unidad) === this.normalizarTexto(item.unidad)
      ) || this.buscarMaterialEnRegistroCompra(item.material);

      if (materialOc) {
        if (materialOc.idDetalle) {
          this.cantidadesOriginalesEdicion.set(Number(materialOc.idDetalle), Number(item.cantidad));
        }
        this.detalle.push(this.crearDetalleItem(materialOc, Number(item.cantidad), item.unidad));
      }
    }
  }

  onMaterialManualChange(idDetalle: number): void {
    const material = this.buscarMaterialPorId(idDetalle);

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
    const material = this.buscarMaterialPorId(Number(value.idDetalle));

    if (!material) {
      this.snackBar.open('El material seleccionado no pertenece al Registro de Compra.', 'Cerrar', {
        duration: 3000
      });
      return;
    }

    const disponible = this.cantidadDisponibleParaRemito(material);
    if (Number(value.cantidad) - disponible >= 0.005) {
      this.snackBar.open(
        `La cantidad supera el saldo disponible para remitos: ${disponible} ${material.unidad}.`,
        'Cerrar',
        { duration: 4000 }
      );
      return;
    }

    this.detalle.push(this.crearDetalleItem(material, Number(value.cantidad), value.unidad));
    this.materialManualForm.reset({
      idDetalle: null,
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

  buscarMaterialPorId(idDetalle: number): DetalleRegistroCompra | null {
    return this.detalleRegistroCompra.find(item => Number(item.idDetalle) === Number(idDetalle)) ?? null;
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
      const idControl = Number(control.get('idDetalle')?.value);
      const idMaterial = Number(material.idDetalle);
      const nombreControl = this.normalizarTexto(control.get('material')?.value);
      const nombreMaterial = this.normalizarTexto(material.nombreMaterial);

      return (!!idControl && idControl === idMaterial) || nombreControl === nombreMaterial;
    });
  }

  quitarMaterial(index: number): void {
    this.detalle.removeAt(index);
  }

  crearDetalleItem(item: DetalleRegistroCompra, cantidad: number | null = null, unidad?: string): FormGroup {
    const disponible = this.cantidadDisponibleParaRemito(item);
    return this.fb.group({
      idDetalle: [item.idDetalle],
      material: [item.nombreMaterial],
      cantidadSolicitada: [item.cantidadSolicitada ?? item.cantidad],
      cantidad: [cantidad, [Validators.required, Validators.min(0.01), Validators.max(disponible)]],
      unidad: [unidad || item.unidad, Validators.required]
    });
  }

  cantidadDisponibleParaRemito(item: DetalleRegistroCompra | null): number {
    if (!item) return 0;
    const solicitado = Number(item.cantidadSolicitada ?? item.cantidad ?? 0);
    const comprometido = Number(item.cantidadEnRemitos ?? 0);
    const cantidadPropia = this.esEdicion && item.idDetalle
      ? Number(this.cantidadesOriginalesEdicion.get(Number(item.idDetalle)) || 0)
      : 0;
    return Math.max(solicitado - comprometido + cantidadPropia, 0);
  }

  guardar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      const faltantes: string[] = [];
      const raw = this.form.getRawValue();
      if (!String(raw.numero || '').trim()) faltantes.push('número de remito');
      if (!raw.fecha) faltantes.push('fecha');
      if (!raw.idRegistroCompra) faltantes.push('OC/FAC asociada');
      if (this.detalle.controls.some(control => control.get('cantidad')?.hasError('max'))) {
        faltantes.push('una cantidad supera el saldo disponible de la OC');
      }
      if (this.detalle.controls.some(control => control.invalid)) faltantes.push('detalle de materiales');
      this.snackBar.open(
        `No se puede guardar. Revisá: ${[...new Set(faltantes)].join(', ') || 'campos marcados en rojo'}.`,
        'Cerrar',
        { duration: 4500 }
      );
      return;
    }

    const detalle = this.detalle.controls
      .map(control => control.value)
      .filter(item => Number(item.cantidad) > 0);

    if (detalle.length === 0) {
      this.snackBar.open('Carga al menos una cantidad recibida.', 'Cerrar', { duration: 3000 });
      return;
    }

    const excedido = detalle.find(item => {
      const material = this.buscarMaterialPorId(Number(item.idDetalle));
      return material && Number(item.cantidad) - this.cantidadDisponibleParaRemito(material) >= 0.005;
    });
    if (excedido) {
      const material = this.buscarMaterialPorId(Number(excedido.idDetalle));
      this.snackBar.open(
        `La cantidad de ${excedido.material} supera el saldo disponible para remitos: `
        + `${material ? this.cantidadDisponibleParaRemito(material) : 0} ${excedido.unidad}.`,
        'Cerrar',
        { duration: 4500 }
      );
      return;
    }

    const rawValue = this.form.getRawValue();
    const payload = {
      numero: rawValue.numero,
      fecha: rawValue.fecha,
      registro_compra_id: rawValue.idRegistroCompra,
      detalle: detalle.map((item: any) => ({
        id_material: null,
        descripcion: item.material,
        cantidad: Number(item.cantidad),
        UoM: item.unidad
      }))
    };

    this.guardando = true;

    const request$ = this.esEdicion && this.remitoId
      ? this.remitosService.actualizarRemito(this.remitoId, payload)
      : this.remitosService.crearRemito(payload);

    request$.subscribe({
      next: () => {
        this.guardando = false;
        this.snackBar.open(
          this.esEdicion ? 'Remito modificado correctamente.' : 'Remito creado correctamente. Queda pendiente de liberacion.',
          'Cerrar', {
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
