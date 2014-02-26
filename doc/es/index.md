<!---
    Licensed to the Apache Software Foundation (ASF) under one
    or more contributor license agreements.  See the NOTICE file
    distributed with this work for additional information
    regarding copyright ownership.  The ASF licenses this file
    to you under the Apache License, Version 2.0 (the
    "License"); you may not use this file except in compliance
    with the License.  You may obtain a copy of the License at

      http://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing,
    software distributed under the License is distributed on an
    "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
    KIND, either express or implied.  See the License for the
    specific language governing permissions and limitations
    under the License.
-->

# org.apache.cordova.file

Este plugin proporciona la [API del sistema de ficheros de HTML5][1]. Para el uso, consulte [FileSystem artículo][2] sobre el tema HTML5 rocas. Para tener una visión general de otras opciones de almacenamiento, consulte [Guía de almacenamiento Cordova][3].

 [1]: http://dev.w3.org/2009/dap/file-system/pub/FileSystem/
 [2]: http://www.html5rocks.com/en/tutorials/file/filesystem/
 [3]: http://cordova.apache.org/docs/en/edge/cordova_storage_storage.md.html

## Instalación

    cordova plugin add org.apache.cordova.file
    

## Plataformas soportadas

*   Amazon fuego OS
*   Android
*   BlackBerry 10 *
*   iOS
*   Windows Phone 7 y 8 *
*   Windows 8 *

* *No son compatibles con estas plataformas `FileReader.readAsArrayBuffer` ni `FileWriter.write(blob)` .*

## Rarezas Android

### Ubicación de almacenamiento persistente Android

Hay múltiples ubicaciones válidas para almacenar archivos persistentes en un dispositivo Android. Vea [esta página][4] para una extensa discusión de las distintas posibilidades.

 [4]: http://developer.android.com/guide/topics/data/data-storage.html

Versiones anteriores de thie plugin elegiría la ubicación de los archivos temporales y persistentes en el arranque, basado en si el dispositivo afirmó que fue montado en la tarjeta SD (o partición de almacenamiento equivalente). Si fue montada en la tarjeta SD, o una partición de gran almacenamiento interno estaba disponible (como en dispositivos de Nexus,) y luego los archivos persistentes se almacenaría en la raíz de ese espacio. Esto significaba que todas las apps Cordova podían ver todos los archivos disponibles en la tarjeta.

Si la tarjeta SD no estaba disponible, entonces las versiones anteriores almacenará datos bajo /data/data /<packageid>, que aísla las apps del otro, pero todavía puede causar datos ser compartido entre los usuarios.

Ahora es posible elegir si desea almacenar archivos en la ubicación de almacenamiento del archivo interno, o usando la lógica anterior, con preferencia en el archivo config.xml de su aplicación. Para ello, añada una de estas dos líneas en config.xml:

    <preference name="AndroidPersistentFileLocation" value="Internal" />
    
    <preference name="AndroidPersistentFileLocation" value="Compatibility" />
    

Sin esta línea, el archivo plugin utilizará "Compatibilidad" como el valor por defecto. Si una etiqueta de preferencia está presente y no es uno de estos valores, no se iniciará la aplicación.

Si su solicitud se ha enviado previamente a los usuarios, mediante una mayor (1.0 pre) versión de este plugin y archivos almacenados en el sistema de ficheros persistente, entonces se debe establecer la preferencia a la "Compatibilidad". Cambiar la ubicación para "Internal" significa que los usuarios existentes que actualización su aplicación pueden ser incapaces de acceder a sus archivos previamente almacenadas, dependiendo de su dispositivo.

Si su solicitud es nueva, o nunca antes ha almacenado archivos en el sistema de ficheros persistente, el ajuste "interno" se recomienda generalmente.

## Rarezas de blackBerry

`DirectoryEntry.removeRecursively()`puede fallar con un `ControlledAccessException` en los siguientes casos:

*   Una aplicación intenta acceder a un directorio creado por una instalación anterior de la aplicación.

> Solución: Asegúrese de directorios temporales se limpian manualmente, o por la aplicación antes de la reinstalación.

*   Si el dispositivo está conectado por USB.

> Solución: Desconecte el cable USB desde el dispositivo y vuelva a ejecutar.

## iOS rarezas

*   `FileReader.readAsText(blob, encoding)` 
    *   El `encoding` no se admite el parámetro, y codificación UTF-8 es siempre en efecto.

### iOS ubicación de almacenamiento persistente

Hay dos ubicaciones válidas para almacenar archivos persistentes en un dispositivo iOS: el directorio de documentos y el directorio de biblioteca. Versiones anteriores de este plugin sólo almacenan archivos persistentes en el directorio de documentos. Esto tenía el efecto secundario de todos los archivos de la aplicación haciendo visible en iTunes, que era a menudo involuntarios, especialmente para aplicaciones que manejan gran cantidad de archivos pequeños, en lugar de producir documentos completos para la exportación, que es la finalidad del directorio.

Ahora es posible elegir si desea almacenar archivos en los documentos o directorio de bibliotecas, con preferencia en el archivo config.xml de su aplicación. Para ello, añada una de estas dos líneas en config.xml:

    <preference name="iosPersistentFileLocation" value="Library" />
    
    <preference name="iosPersistentFileLocation" value="Compatibility" />
    

Sin esta línea, el archivo plugin utilizará "Compatibilidad" como el valor por defecto. Si una etiqueta de preferencia está presente y no es uno de estos valores, no se iniciará la aplicación.

Si su solicitud se ha enviado previamente a los usuarios, mediante una mayor (1.0 pre) versión de este plugin y archivos almacenados en el sistema de ficheros persistente, entonces se debe establecer la preferencia a la "Compatibilidad". Cambiar la ubicación a la "Biblioteca" significa que los usuarios existentes que actualización su aplicación sería incapaces de acceder a sus archivos previamente almacenadas.

Si su solicitud es nueva, o nunca antes ha almacenado archivos en el sistema de ficheros persistente, el ajuste de "Biblioteca" generalmente se recomienda.