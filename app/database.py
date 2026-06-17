from pymongo import MongoClient

# Usamos MongoClient (síncrono) en lugar de AsyncIOMotorClient
MONGO_DETAILS = "mongodb://admin:secretpassword@localhost:27017"

# Conexión síncrona
client = MongoClient(MONGO_DETAILS)

# Acceso a la base de datos y colección
database = client.architecture_db
services_collection = database.get_collection("services")