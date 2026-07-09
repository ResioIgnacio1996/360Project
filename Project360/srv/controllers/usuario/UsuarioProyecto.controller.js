const { conectarDB, sql } = require('../../DB/dbConection');


// INSERT
const asignarUsuarioProyecto = async (req, res) => {
    try {

        const {
            usuario_id,
            proyecto_id,
            rol,
            activo
        } = req.body;

        // VALIDACIONES
        if (!usuario_id || !proyecto_id || !rol) {
            return res.status(400).json({
                message: 'usuario_id, proyecto_id y rol son obligatorios'
            });
        }

        const pool = await conectarDB();

        // VALIDAR SI YA EXISTE
        const existe = await pool.request()
            .input('usuario_id', sql.BigInt, usuario_id)
            .input('proyecto_id', sql.BigInt, proyecto_id)
            .query(`
                SELECT TOP 1 *
                FROM Usuario_Proyecto
                WHERE usuario_id = @usuario_id
                AND proyecto_id = @proyecto_id
            `);

        if (existe.recordset.length > 0) {
            return res.status(400).json({
                message: 'El usuario ya está asignado al proyecto'
            });
        }

        // INSERT
        const result = await pool.request()
            .input('usuario_id', sql.BigInt, usuario_id)
            .input('proyecto_id', sql.BigInt, proyecto_id)
            .input('rol', sql.BigInt, rol)
            .input('activo', sql.Bit, activo ?? true)
            .query(`
                INSERT INTO Usuario_Proyecto (
                    usuario_id,
                    proyecto_id,
                    rol,
                    activo,
                    fecha_asignacion
                )
                OUTPUT INSERTED.*
                VALUES (
                    @usuario_id,
                    @proyecto_id,
                    @rol,
                    @activo,
                    GETDATE()
                )
            `);

        res.status(201).json({
            message: 'Usuario asignado correctamente al proyecto',
            data: result.recordset[0]
        });

    } catch (error) {

        console.error('Error al asignar usuario a proyecto:', error);

        res.status(500).json({
            message: 'Error interno del servidor'
        });

    }
};


// DELETE
const eliminarUsuarioProyecto = async (req, res) => {

    try {

        const { id } = req.params;

        const pool = await conectarDB();

        const result = await pool.request()
            .input('usuario_proyecto_id', sql.BigInt, id)
            .query(`
                DELETE FROM Usuario_Proyecto
                WHERE usuario_proyecto_id = @usuario_proyecto_id
            `);

        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({
                message: 'Asignación no encontrada'
            });
        }

        res.json({
            message: 'Asignación eliminada correctamente'
        });

    } catch (error) {

        console.error('Error al eliminar asignación:', error);

        res.status(500).json({
            message: 'Error interno del servidor'
        });

    }

};


module.exports = {
    asignarUsuarioProyecto,
    eliminarUsuarioProyecto
};