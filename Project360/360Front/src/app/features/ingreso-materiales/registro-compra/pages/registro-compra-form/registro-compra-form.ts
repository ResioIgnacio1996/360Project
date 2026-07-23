import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import {
  FormArray,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable, map, startWith } from 'rxjs';

import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatSelectModule } from '@angular/material/select';

import { RegistroCompraService } from '../../../../../core/services/registro-compra/registro-compra';
import { ProveedorService } from '../../../../../core/services/proveedor/proveedor';
import { ProyectoService } from '../../../../../core/services/proyecto/proyecto';
import { MaterialService } from '../../../../../core/services/material/material';

import {
  DetalleRegistroCompra,
  RegistroCompraImportResponse,
  RegistroCompraPayload
} from '../../../../../shared/interfaces/RegistroDeCompra.interface';

@Component({
  selector: 'app-registro-compra-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    MatAutocompleteModule,
    MatSelectModule
  ],
  templateUrl: './registro-compra-form.html',
  styleUrl: './registro-compra-form.css'
})
export class RegistroCompraForm implements OnInit {

  form!: FormGroup;

  idRegistroCompra?: number;
  modoEdicion = false;

  isDragging = false;
  archivoSeleccionado: File | null = null;

  importando = false;
  guardando = false;

  advertencias: string[] = [];

proveedores: any[] = [];

  proveedoresFiltradosNombre$!: Observable<any[]>;
  proveedoresFiltradosCuit$!: Observable<any[]>;

 proyectos: any[] = [];
materiales: any[] = [];
uoms: any[] = [];
  materialesFiltrados$: Observable<any[]>[] = [];

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
    private snackBar: MatSnackBar,
    private router: Router,
    private route: ActivatedRoute,
    private proveedorService: ProveedorService,
    private proyectoService: ProyectoService,
    private materialService: MaterialService
  ) {}

  ngOnInit(): void {
    this.inicializarFormulario();
    this.configurarAutocompleteProveedor();
    this.configurarValidacionFechas();
    this.cargarProveedores();
    this.cargarProyectos();
    this.cargarMateriales();
    this.cargarUom();

    const id = this.route.snapshot.paramMap.get('id');

    if (id) {
      this.idRegistroCompra = Number(id);
      this.modoEdicion = true;
      this.cargarRegistro(this.idRegistroCompra);
    }
  }

  inicializarFormulario(): void {
    this.form = this.fb.group({
      numero: ['', Validators.required],
      tipo: ['OC', Validators.required],
      fecha: ['', Validators.required],
      fechaEntrega: [''],
      observaciones: [''],
      idProyecto: [null],

      proveedor: this.fb.group({
        idProveedor: [null],
        razonSocial: ['', Validators.required],
        cuit: ['']
      }),

      detalle: this.fb.array([])
    });

    this.agregarMaterial(false);
  }

  get detalle(): FormArray {
    return this.form.get('detalle') as FormArray;
  }

  configurarAutocompleteProveedor(): void {
    const nombreControl = this.form.get('proveedor.razonSocial');
    const cuitControl = this.form.get('proveedor.cuit');

    if (!nombreControl || !cuitControl) {
      return;
    }

    this.proveedoresFiltradosNombre$ = nombreControl.valueChanges.pipe(
      startWith(''),
      map(value => this.filtrarProveedoresPorNombre(value || ''))
    );

    this.proveedoresFiltradosCuit$ = cuitControl.valueChanges.pipe(
      startWith(''),
      map(value => this.filtrarProveedoresPorCuit(value || ''))
    );
  }

  filtrarProveedoresPorNombre(value: unknown): any[] {
    const filtro = this.normalizarBusquedaProveedor(value);

    return this.proveedores.filter(proveedor =>
      this.normalizarBusquedaProveedor(proveedor.razonSocial).includes(filtro)
    );
  }

  filtrarProveedoresPorCuit(value: unknown): any[] {
    const filtro = this.normalizarCuitProveedor(value);

    return this.proveedores.filter(proveedor =>
      this.normalizarCuitProveedor(proveedor.cuit).includes(filtro)
    );
  }

  seleccionarProveedor(proveedor: any): void {
    this.form.patchValue({
      proveedor: {
        idProveedor: proveedor.idProveedor,
        razonSocial: proveedor.razonSocial,
        cuit: proveedor.cuit
      }
    });
  }

  limpiarProveedorSiEditaManual(): void {
    this.form.get('proveedor.idProveedor')?.setValue(null);
  }

  displayProveedorNombre(proveedor: any): string {
    return typeof proveedor === 'string'
      ? proveedor
      : proveedor?.razonSocial ?? '';
  }

  displayProveedorCuit(proveedor: any): string {
    return typeof proveedor === 'string'
      ? proveedor
      : proveedor?.cuit ?? '';
  }

  proveedorSeleccionado(): boolean {
    return !!this.form.get('proveedor.idProveedor')?.value;
  }

  proveedorNuevoPendiente(): boolean {
    const proveedor = this.form.get('proveedor')?.value;

    return !proveedor?.idProveedor
      && !!proveedor?.razonSocial?.trim()
      && !!proveedor?.cuit?.trim();
  }

  private normalizarBusquedaProveedor(value: unknown): string {
    const texto = typeof value === 'string'
      ? value
      : `${(value as any)?.razonSocial ?? ''} ${(value as any)?.cuit ?? ''}`;

    return texto.trim().toLowerCase();
  }

  private normalizarCuitProveedor(value: unknown): string {
    const texto = typeof value === 'string'
      ? value
      : (value as any)?.cuit ?? '';

    return texto.replace(/\D/g, '');
  }

  crearDetalleItem(item?: Partial<DetalleRegistroCompra>): FormGroup {
    return this.fb.group({
      idMaterial: [item?.idMaterial ?? null],
      nombreMaterial: [item?.nombreMaterial ?? '', Validators.required],
      descripcionOriginal: [item?.descripcionOriginal ?? ''],
      cantidad: [item?.cantidad ?? null, [Validators.required, Validators.min(1)]],
      unidad: [this.obtenerUnidadCatalogada(item?.unidad) ?? '', Validators.required],
      existe: [item?.existe ?? false]
    });
  }

  agregarMaterial(validarUltimaFila: boolean = false): void {
    if (validarUltimaFila && this.detalle.length > 0) {
      const ultimaFila = this.detalle.at(this.detalle.length - 1) as FormGroup;

      if (ultimaFila.invalid) {
        ultimaFila.markAllAsTouched();

        this.snackBar.open(
          'Completá la fila actual antes de agregar otra.',
          'Cerrar',
          { duration: 3000 }
        );

        return;
      }
    }

    const index = this.detalle.length;
    const item = this.crearDetalleItem();

    this.detalle.push(item);
    this.configurarAutocompleteMaterial(index);
  }

 agregarFilaConEnter(event: Event, index: number): void {

  event.preventDefault();

  const fila = this.detalle.at(index) as FormGroup;

  if (fila.invalid) {
    fila.markAllAsTouched();

    this.snackBar.open(
      'Completá material, cantidad y unidad antes de agregar otra fila.',
      'Cerrar',
      { duration: 3000 }
    );

    return;
  }

  if (index !== this.detalle.length - 1) {
    return;
  }

  this.agregarMaterial(false);

  setTimeout(() => {
    const inputs = document.querySelectorAll<HTMLInputElement>(
      'input[formcontrolname="nombreMaterial"]'
    );

    inputs[inputs.length - 1]?.focus();
  });

}
  configurarAutocompleteMaterial(index: number): void {
    const control = this.detalle.at(index).get('nombreMaterial');

    if (!control) {
      return;
    }

    this.materialesFiltrados$[index] = control.valueChanges.pipe(
      startWith(control.value || ''),
      map(value => this.filtrarMateriales(value || ''))
    );
  }

  filtrarMateriales(value: string): any[] {
    const filtro = value.toLowerCase();

    return this.materiales.filter(material =>
      material.nombreMaterial.toLowerCase().includes(filtro) ||
      material.unidad?.toLowerCase().includes(filtro)
    );
  }

  seleccionarMaterial(index: number, material: any): void {
    const row = this.detalle.at(index);

    row.patchValue({
      idMaterial: material.idMaterial,
      nombreMaterial: material.nombreMaterial,
      unidad: this.obtenerUnidadCatalogada(material.unidad) ?? row.get('unidad')?.value,
      existe: true
    });

    setTimeout(() => {
      const cantidadInputs = document.querySelectorAll<HTMLInputElement>(
        'input[formcontrolname="cantidad"]'
      );

      cantidadInputs[index]?.focus();
    });
  }

  limpiarMaterialSiEditaManual(index: number): void {
    const row = this.detalle.at(index);
    row.get('idMaterial')?.setValue(null);
    row.get('existe')?.setValue(false);
  }

  materialNuevoPendiente(index: number): boolean {
    const row = this.detalle.at(index);
    const idMaterial = row.get('idMaterial')?.value;
    const nombreMaterial = row.get('nombreMaterial')?.value;
    const unidad = row.get('unidad')?.value;

    return !idMaterial && !!nombreMaterial?.trim() && !!unidad;
  }

  quitarMaterial(index: number): void {
    if (this.detalle.length === 1) {
      this.snackBar.open('El registro debe tener al menos un material.', 'Cerrar', {
        duration: 3000
      });
      return;
    }

    this.detalle.removeAt(index);
    this.materialesFiltrados$.splice(index, 1);
  }

  configurarValidacionFechas(): void {
    this.form.get('fecha')?.valueChanges.subscribe(() => {
      this.validarFechaEntrega();
    });

    this.form.get('fechaEntrega')?.valueChanges.subscribe(() => {
      this.validarFechaEntrega();
    });
  }

  validarFechaEntrega(): boolean {
    const fecha = this.form.get('fecha')?.value;
    const fechaEntregaControl = this.form.get('fechaEntrega');
    const fechaEntrega = fechaEntregaControl?.value;

    if (!fechaEntregaControl) {
      return true;
    }

    if (!fecha || !fechaEntrega) {
      fechaEntregaControl.setErrors(null);
      return true;
    }

    if (fechaEntrega < fecha) {
      fechaEntregaControl.setErrors({ fechaInvalida: true });
      return false;
    }

    if (fechaEntregaControl.hasError('fechaInvalida')) {
      fechaEntregaControl.setErrors(null);
    }

    return true;
  }

  cargarRegistro(id: number): void {
    this.registroCompraService.getRegistroById(id).subscribe({
      next: (registro: any) => {
        this.form.patchValue({
          numero: registro.numero,
          tipo: registro.tipo ?? 'OC',
          fecha: this.normalizarFecha(registro.fecha),
          fechaEntrega: this.normalizarFecha(registro.fechaEntrega),
          observaciones: registro.observaciones,
          idProyecto: registro.proyecto?.idProyecto ?? null,
          proveedor: {
            idProveedor: registro.proveedor?.idProveedor ?? null,
            razonSocial: registro.proveedor?.razonSocial ?? '',
            cuit: registro.proveedor?.cuit ?? ''
          }
        });

        this.detalle.clear();
        this.materialesFiltrados$ = [];

        if (registro.detalle?.length) {
          registro.detalle.forEach((item: any, index: number) => {
            this.detalle.push(this.crearDetalleItem({
              idMaterial: item.idMaterial,
              nombreMaterial: item.nombreMaterial,
              descripcionOriginal: item.descripcionOriginal,
              cantidad: item.cantidadSolicitada ?? item.cantidad,
              unidad: item.unidad,
              existe: true
            }));

            this.configurarAutocompleteMaterial(index);
          });
        } else {
          this.agregarMaterial(false);
        }
      },
      error: () => {
        this.snackBar.open('Error al cargar el registro de compra.', 'Cerrar', {
          duration: 3000
        });
      }
    });
  }

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
      this.seleccionarArchivo(file);
    }
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
      this.snackBar.open('Formato no permitido. Usá PDF, JPG, JPEG, PNG o WEBP.', 'Cerrar', {
        duration: 3500
      });
      return false;
    }

    if (file.size > this.maxSizeBytes) {
      this.snackBar.open('El archivo supera el tamaño máximo permitido de 10 MB.', 'Cerrar', {
        duration: 3500
      });
      return false;
    }

    return true;
  }

  importarDocumento(): void {
    if (!this.archivoSeleccionado) {
      this.snackBar.open('Seleccioná un archivo para importar.', 'Cerrar', {
        duration: 3000
      });
      return;
    }

    this.importando = true;

    this.registroCompraService.importarDocumento(this.archivoSeleccionado).subscribe({
      next: (response: RegistroCompraImportResponse) => {
        this.importando = false;

        if (!response.success) {
          this.snackBar.open(response.message || 'No se pudo procesar el documento.', 'Cerrar', {
            duration: 3500
          });
          return;
        }

        this.aplicarDatosImportados(response);

        this.snackBar.open('Documento procesado correctamente. Revisá los datos antes de guardar.', 'Cerrar', {
          duration: 4000
        });
      },
      error: (error) => {
        this.importando = false;
        const mensaje =
          error?.error?.error ||
          error?.error?.message ||
          'Error al procesar el documento.';

        this.snackBar.open(mensaje, 'Cerrar', {
          duration: 3500
        });
      }
    });
  }

  aplicarDatosImportados(response: RegistroCompraImportResponse): void {
    const data = response.data;

    this.form.patchValue({
      numero: data.registroCompra?.numero ?? '',
      tipo: this.normalizarTipoDocumento(data.registroCompra?.tipo),
      fecha: this.normalizarFecha(data.registroCompra?.fecha),
      fechaEntrega: this.normalizarFecha(data.registroCompra?.fechaEntrega),
      observaciones: data.registroCompra?.observaciones ?? '',
      idProyecto: data.registroCompra?.proyecto?.idProyecto ?? null,
      proveedor: {
        idProveedor: data.proveedor?.idProveedor ?? null,
        razonSocial: data.proveedor?.razonSocial ?? '',
        cuit: data.proveedor?.cuit ?? ''
      }
    });

    this.detalle.clear();
    this.materialesFiltrados$ = [];

    const advertenciasUnidad: string[] = [];

    if (data.detalle?.length) {
      data.detalle.forEach((item, index) => {
        const unidadCatalogada = this.obtenerUnidadCatalogada(item.unidad);

        if (this.uoms.length && item.unidad && !unidadCatalogada) {
          advertenciasUnidad.push(`La unidad ${item.unidad} no existe en UOM. Selecciona una unidad valida para ${item.nombreMaterial}.`);
        }

        this.detalle.push(this.crearDetalleItem({
          ...item,
          unidad: unidadCatalogada ?? item.unidad ?? ''
        }));
        this.configurarAutocompleteMaterial(index);
      });
    } else {
      this.agregarMaterial(false);
    }

    this.advertencias = [
      ...(data.advertencias ?? []),
      ...advertenciasUnidad
    ];
  }

guardar(): void {
  if (!this.validarFechaEntrega()) {
    this.snackBar.open(
      'La fecha de entrega no puede ser menor a la fecha del Registro de Compra.',
      'Cerrar',
      { duration: 3500 }
    );
    return;
  }

  if (this.form.invalid || this.detalle.length === 0) {
    this.form.markAllAsTouched();
    this.snackBar.open('Completa los campos obligatorios antes de guardar.', 'Cerrar', {
      duration: 3500
    });
    return;
  }

  if (!this.validarProveedorParaGuardar() || !this.validarMaterialesParaGuardar()) {
    return;
  }

  const payload = this.construirPayloadRegistroCompra();

  this.guardando = true;

  const request$ = this.modoEdicion && this.idRegistroCompra
    ? this.registroCompraService.actualizarRegistro(this.idRegistroCompra, payload)
    : this.registroCompraService.crearRegistro(payload);

  request$.subscribe({
    next: () => {
      this.guardando = false;

      this.snackBar.open(
        this.modoEdicion
          ? 'Registro de compra actualizado correctamente.'
          : 'Registro de compra creado correctamente.',
        'Cerrar',
        { duration: 3000 }
      );

      this.router.navigate(['/ingreso-materiales/registro-compra']);
    },
    error: (error) => {
      this.guardando = false;

      const mensaje =
        error?.error?.error ||
        error?.error?.message ||
        'Error al guardar el registro de compra.';

      this.snackBar.open(mensaje, 'Cerrar', {
        duration: 3500
      });
    }
  });
}

  validarProveedorParaGuardar(): boolean {
    const proveedor = this.form.get('proveedor')?.value;

    if (proveedor?.idProveedor) {
      return true;
    }

    if (!proveedor?.razonSocial?.trim()) {
      this.snackBar.open('Informa la razon social del proveedor.', 'Cerrar', {
        duration: 3500
      });
      return false;
    }

    if (!proveedor?.cuit?.trim()) {
      this.snackBar.open('Informa el CUIT para crear el proveedor automaticamente.', 'Cerrar', {
        duration: 3500
      });
      return false;
    }

    return true;
  }

  validarMaterialesParaGuardar(): boolean {
    const materialInvalido = this.detalle.controls.some(control => {
      const fila = control as FormGroup;
      const tieneId = !!fila.get('idMaterial')?.value;
      const nombre = fila.get('nombreMaterial')?.value?.trim();
      const cantidad = Number(fila.get('cantidad')?.value);
      const unidad = fila.get('unidad')?.value?.trim();

      return !tieneId && (!nombre || !cantidad || cantidad <= 0 || !unidad);
    });

    if (materialInvalido) {
      this.snackBar.open(
        'Para crear materiales nuevos, informa nombre, cantidad y unidad.',
        'Cerrar',
        { duration: 3500 }
      );
      return false;
    }

    return true;
  }

  construirPayloadRegistroCompra(): any {
    const formValue = this.form.value;
    const proveedor = formValue.proveedor;

    const payload: any = {
      numero: formValue.numero,
      tipo: this.normalizarTipoDocumento(formValue.tipo),
      fecha: formValue.fecha,
      fecha_entrega: formValue.fechaEntrega || null,
      proyecto_id: formValue.idProyecto || null,
      observaciones: formValue.observaciones || null,
      detalle: formValue.detalle.map((item: any) => this.mapearDetalleParaBackend(item))
    };

    if (proveedor?.idProveedor) {
      payload.proveedor_id = proveedor.idProveedor;
    } else {
      payload.proveedor = {
        razon_social: proveedor.razonSocial?.trim(),
        cuit: proveedor.cuit?.trim()
      };
    }

    return payload;
  }

  mapearDetalleParaBackend(item: any): any {
    const detalle: any = {
      cantidad: Number(item.cantidad),
      UoM: this.obtenerUnidadCatalogada(item.unidad) ?? item.unidad
    };

    if (item.idMaterial) {
      detalle.id_material = item.idMaterial;
    } else {
      const nombreMaterial = item.nombreMaterial?.trim();
      detalle.nombre = nombreMaterial;
      detalle.descripcion = item.descripcionOriginal?.trim() || nombreMaterial;
    }

    return detalle;
  }

  cancelar(): void {
    this.router.navigate(['/ingreso-materiales/registro-compra']);
  }
  normalizarFecha(fecha?: string | null): string {
    if (!fecha) {
      return '';
    }

    return fecha.substring(0, 10);
  }
  cargarProveedores(): void {
    this.proveedorService.getProveedores().subscribe({
      next: (resp: any) => {
        this.proveedores = (Array.isArray(resp) ? resp : resp.data ?? []).map((proveedor: any) => ({
          ...proveedor,
          idProveedor: proveedor.proveedor_id ?? proveedor.idProveedor,
          razonSocial: proveedor.razon_social ?? proveedor.razonSocial ?? proveedor.nombre ?? '',
          cuit: proveedor.cuit ?? ''
        }));

        this.configurarAutocompleteProveedor();
      },
      error: () => {
        this.snackBar.open('Error al cargar proveedores.', 'Cerrar', { duration: 3000 });
      }
    });
  }

  cargarProyectos(): void {
    this.proyectoService.getProyectos().subscribe({
      next: (resp: any) => {
        this.proyectos = (Array.isArray(resp) ? resp : resp.data ?? []).map((proyecto: any) => ({
          ...proyecto,
          idProyecto: proyecto.proyecto_id ?? proyecto.idProyecto,
          nombre: proyecto.nombre ?? proyecto.descripcion ?? ''
        }));
      },
      error: () => {
        this.snackBar.open('Error al cargar proyectos.', 'Cerrar', { duration: 3000 });
      }
    });
  }

  cargarMateriales(): void {
    this.materialService.getMateriales().subscribe({
      next: (resp: any) => {
        this.materiales = (Array.isArray(resp) ? resp : resp.data ?? []).map((material: any) => ({
          ...material,
          idMaterial: material.id_material ?? material.idMaterial,
          nombreMaterial: material.nombre ?? material.nombreMaterial ?? material.descripcion ?? '',
          unidad: material.UoM ?? material.unidad ?? material.unidad_medida ?? ''
        }));

        this.detalle.controls.forEach((_, index) => {
          this.configurarAutocompleteMaterial(index);
        });
      },
      error: () => {
        this.snackBar.open('Error al cargar materiales.', 'Cerrar', { duration: 3000 });
      }
    });
  }

  cargarUom(): void {
    this.materialService.getUom().subscribe({
      next: (resp: any) => {
        this.uoms = (Array.isArray(resp) ? resp : resp.data ?? []).map((uom: any) => ({
          idUom: uom.uom_id ?? uom.idUom,
          nombre: uom.nombre ?? ''
        }));

        this.normalizarUnidadesDetalleConCatalogo();
      },
      error: () => {
        this.snackBar.open('Error al cargar unidades de medida.', 'Cerrar', { duration: 3000 });
      }
    });
  }

  private normalizarUnidadesDetalleConCatalogo(): void {
    this.detalle.controls.forEach(control => {
      const row = control as FormGroup;
      const unidadActual = row.get('unidad')?.value;
      const unidadCatalogada = this.obtenerUnidadCatalogada(unidadActual);

      if (unidadActual && unidadCatalogada) {
        row.get('unidad')?.setValue(unidadCatalogada, { emitEvent: false });
      } else if (unidadActual && this.uoms.length) {
        row.get('unidad')?.setValue('', { emitEvent: false });
      }
    });
  }

  private obtenerUnidadCatalogada(unidad?: string | null): string | null {
    const unidadNormalizada = this.normalizarUnidad(unidad);

    if (!unidadNormalizada) {
      return null;
    }

    const encontrada = this.uoms.find(uom =>
      this.normalizarUnidad(uom.nombre) === unidadNormalizada
    );

    return encontrada?.nombre ?? (!this.uoms.length ? unidad?.trim() || null : null);
  }

  private normalizarUnidad(unidad?: string | null): string {
    return (unidad ?? '').trim().toUpperCase();
  }

  private normalizarTipoDocumento(tipo?: string | null): 'OC' | 'FAC' {
    const value = (tipo ?? '').trim().toUpperCase();

    if (['FAC', 'FACTURA', 'FC', 'FRA'].includes(value)) {
      return 'FAC';
    }

    return 'OC';
  }
}
