# app/application/syncService.py

class SyncService:
    def __init__(self, reader, comparator, repo):
        self.reader = reader
        self.comparator = comparator
        self.repo = repo

    def execute(self):
        print("📥 Leyendo datos del Excel...")
        dic_rows, per_rows = self.reader.read_excel_sheets()
        
        print("⚙️ Reconciliando información...")
        # Aquí es donde el 'ComparatorService' hace su magia
        reconciled_data = self.comparator.reconcile(dic_rows, per_rows)
        
        print("💾 Guardando en base de datos...")
        self.repo.save_reconciled_services(reconciled_data)
        
        print(f"✅ Se han procesado {len(reconciled_data)} servicios.")