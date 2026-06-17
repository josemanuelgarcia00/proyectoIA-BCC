"""
GENERADOR DE ARCHIVO EXCEL DE EJEMPLO
Crea un archivo servicios.xlsx con estructura de prueba
"""
import pandas as pd
from pathlib import Path


def crear_excel_ejemplo():
    """Crea un archivo Excel con estructura de Perímetro y Diccionario"""
    
    # Datos de Perímetro (con iteraciones y conflictos)
    perimetro_data = {
        'Nombre': [
            'ACTIVOS',                    # Iteración 1
            'ACTIVOS (2)',                # Iteración 2 - con cambios
            'PASIVOS',                    # Una sola iteración
            'PATRIMONIO',                 # Iteración 1
            'PATRIMONIO (2)',             # Iteración 2 - con cambios
        ],
        'Aplicación': [
            'APP_CORE_BANKING',
            'APP_CORE_BANKING',
            'APP_CORE_BANKING',
            'APP_PATRIMONIO',
            'APP_PATRIMONIO',
        ],
        'Tipo': [
            'Recurso',
            'Recurso',
            'Recurso',
            'Recurso',
            'Recurso',
        ],
        'Verbo': [
            'GET',
            'GET',
            'GET',
            'GET',
            'GET',
        ],
        'Alcance': [
            'Nivel de Sucursal',
            'Nivel Global',  # CONFLICTO
            'Nivel Cliente',
            'Nivel Corporativo',
            'Nivel Corporativo',
        ],
        'Uso Funcional': [
            'Obtener listado de activos del cliente',
            'Obtener listado de activos del cliente',
            'Obtener pasivos del cliente',
            'Obtener información de patrimonio neto',
            'Obtener información de patrimonio neto del grupo',  # CONFLICTO
        ],
        'Entradas': [
            'client_id, date_from',
            'client_id, date_from, filter_type',  # CONFLICTO
            'client_id',
            'company_id, fiscal_year',
            'company_id, fiscal_year, include_subsidiaries',  # CONFLICTO
        ],
        'Salidas': [
            'assets_list, total_value',
            'assets_list, total_value',
            'liabilities_list, total_debt',
            'equity_value, composition',
            'equity_value, composition, consolidated_equity',  # CONFLICTO
        ],
        'Invoca': [
            'asset_service, valuation_service',
            'asset_service, valuation_service, compliance_check',  # CONFLICTO
            'liability_service',
            'equity_calculator',
            'equity_calculator, group_consolidator',  # CONFLICTO
        ],
        'Tablas de Referencia': [
            'assets_master, asset_types',
            'assets_master, asset_types, compliance_rules',  # CONFLICTO
            'liabilities_master',
            'equity_master',
            'equity_master, group_structure',  # CONFLICTO
        ],
        'Documento Origen': [
            'Sistema Origen - v1',
            'Sistema Origen - v2',
            'Sistema Origen',
            'Perímetro - Iteración 1',
            'Perímetro - Iteración 2',
        ],
        'Versión': [
            '1.0.0',
            '2.0.0',
            '1.0.0',
            '0.1.0',
            '0.2.0',
        ],
        'Confiabilidad': [
            'Alta',
            'Muy Alta',
            'Alta',
            'Media',
            'Media-Alta',
        ],
    }
    
    # Datos de Diccionario (base de datos)
    diccionario_data = {
        'Nombre': [
            'ACTIVOS',
            'PASIVOS',
            'PATRIMONIO',
        ],
        'Aplicación': [
            'APP_CORE_BANKING',
            'APP_CORE_BANKING',
            'APP_PATRIMONIO_LEGACY',
        ],
        'Tipo': [
            'Recurso',
            'Recurso',
            'Recurso',
        ],
        'Verbo': [
            'GET',
            'GET',
            'GET',
        ],
        'Alcance': [
            'Nivel de Sucursal',
            'Nivel Cliente',
            'Nivel Corporativo',
        ],
        'Uso Funcional': [
            'Obtener listado de activos del cliente',
            'Obtener pasivos del cliente',
            'Obtener información de patrimonio',
        ],
        'Entradas': [
            'client_id, date_from',
            'client_id',
            'company_id',
        ],
        'Salidas': [
            'assets_list, total_value',
            'liabilities_list, total_debt',
            'equity_value',
        ],
        'Invoca': [
            'asset_service, valuation_service',
            'liability_service',
            'equity_calculator',
        ],
        'Tablas de Referencia': [
            'assets_master, asset_types',
            'liabilities_master',
            'equity_master',
        ],
        'Documento Origen': [
            'Sistema Origen Original',
            'Sistema Origen Original',
            'Sistema Origen Original',
        ],
        'Versión': [
            '1.0.0',
            '1.0.0',
            '0.1.0',
        ],
        'Confiabilidad': [
            'Alta',
            'Alta',
            'Media',
        ],
    }
    
    # Crear DataFrames
    df_perimetro = pd.DataFrame(perimetro_data)
    df_diccionario = pd.DataFrame(diccionario_data)
    
    # Guardar en Excel
    output_path = Path(__file__).parent.parent.parent / 'servicios.xlsx'
    
    with pd.ExcelWriter(output_path, engine='openpyxl') as writer:
        df_diccionario.to_excel(writer, sheet_name='Diccionario', index=False)
        df_perimetro.to_excel(writer, sheet_name='Perímetro', index=False)
    
    print(f"✅ Archivo Excel creado en: {output_path}")
    print(f"   - Hoja Diccionario: {len(df_diccionario)} registros")
    print(f"   - Hoja Perímetro: {len(df_perimetro)} registros")
    print()
    print("📊 Servicios con conflictos detectados:")
    print("   1. ACTIVOS - 2 iteraciones (conflictos en Alcance, Entradas, Invoca, Tablas)")
    print("   2. PASIVOS - 1 iteración (sin conflictos)")
    print("   3. PATRIMONIO - 2 iteraciones (conflictos en Uso Funcional, Entradas, Salidas, Invoca, Tablas)")


if __name__ == "__main__":
    crear_excel_ejemplo()
