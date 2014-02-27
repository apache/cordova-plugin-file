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

Ce plugin fournit les [API de système de fichiers de HTML5][1]. Pour son utilisation, reportez-vous à l'HTML5 Rocks' [FileSystem article][2] sur le sujet. Pour un aperçu des autres options de stockage, consultez [guide d'entreposage de Cordova][3].

 [1]: http://dev.w3.org/2009/dap/file-system/pub/FileSystem/
 [2]: http://www.html5rocks.com/en/tutorials/file/filesystem/
 [3]: http://cordova.apache.org/docs/en/edge/cordova_storage_storage.md.html

## Installation

    cordova plugin add org.apache.cordova.file
    

## Plates-formes prises en charge

*   Amazon Fire OS
*   Android
*   BlackBerry 10 *
*   iOS
*   Windows Phone 7 et 8 *
*   Windows 8 *

* *Ces plates-formes ne supportent pas `FileReader.readAsArrayBuffer` ni `FileWriter.write(blob)` .*

## Quirks Android

### Emplacement de stockage persistant Android

Il y a plusieurs emplacements valides pour stocker des fichiers persistants sur un appareil Android. Voir [cette page][4] pour une analyse approfondie des diverses possibilités.

 [4]: http://developer.android.com/guide/topics/data/data-storage.html

Les versions précédentes de thie plugin choisirait l'emplacement des fichiers temporaires et persistantes au démarrage, basé sur la question de savoir si le dispositif réclamé que la carte SD (ou une partition de stockage équivalent) a été montée. Si la carte SD a été montée, ou si une partition de stockage interne importante était disponible (comme sur les appareils Nexus,) puis les fichiers persistants seraient stockés dans la racine de cet espace. Cela signifie que toutes les apps de Cordova pouvaient voir tous les fichiers disponibles sur la carte.

Si la carte SD n'était pas disponible, alors les versions précédentes seraient stocker des données sous/données/data /<packageid>, qui isole les apps de l'autre, mais peuvent encore provoquer des données à partager entre les utilisateurs.

Il est maintenant possible de choisir de stocker les fichiers dans l'emplacement de stockage de fichier interne, ou en utilisant la logique précédente, avec une préférence dans le fichier config.xml de votre application. Pour ce faire, ajoutez l'un des ces deux lignes au fichier config.xml :

    <preference name="AndroidPersistentFileLocation" value="Internal" />
    
    <preference name="AndroidPersistentFileLocation" value="Compatibility" />
    

Sans cette ligne, le fichier plugin utilisera la valeur par défaut « Compatibilité ». Si une balise de préférence est présente et n'est pas une des valeurs suivantes, l'application ne démarrera pas.

Si votre application a déjà été expédiée aux utilisateurs, en utilisant une ancienne (avant 1.0) version de ce plugin et dispose des fichiers stockés dans le système de fichiers persistant, alors vous devez définir la préférence à la « Compatibilité ». Commutation de l'emplacement « Internal » signifierait que les utilisateurs existants qui mettre à niveau leur application peuvent être impossible d'accéder à leurs fichiers déjà enregistrés, selon leur appareil.

Si votre application est nouvelle ou a jamais précédemment stocké les fichiers dans le système de fichiers persistant, alors le paramètre « interne » est généralement recommandé.

## Bizarreries de blackBerry

`DirectoryEntry.removeRecursively()`peut échouer avec un `ControlledAccessException` dans les cas suivants :

*   Une application tente d'accéder à un répertoire créé par une installation précédente de l'application.

> Solution : Vérifiez les répertoires temporaires sont nettoyés manuellement, ou par l'application avant la réinstallation.

*   Si le périphérique est connecté par USB.

> Solution : déconnecter le câble USB de l'appareil et exécutez à nouveau.

## iOS Quirks

*   `FileReader.readAsText(blob, encoding)` 
    *   Le `encoding` paramètre n'est pas pris en charge, et le codage UTF-8 est toujours en vigueur.

### emplacement de stockage persistant d'iOS

Il y a deux emplacements valides pour stocker des fichiers persistants sur un appareil iOS : le répertoire de Documents et le répertoire de la bibliothèque. Les versions précédentes de thie plugin stockaient ne jamais fichiers persistants dans le répertoire de Documents. Cela a eu l'effet secondaire de rendre tous les fichiers de l'application visible dans iTunes, qui était souvent inattendus, en particulier pour les applications qui traitent beaucoup de petits fichiers, plutôt que de produire des documents complets destinés à l'exportation, qui est l'objectif visé par le répertoire.

Il est maintenant possible de choisir de stocker les fichiers dans le répertoire de bibliothèque, avec une préférence dans le fichier config.xml de votre application ou de documents. Pour ce faire, ajoutez l'un des ces deux lignes au fichier config.xml :

    <preference name="iosPersistentFileLocation" value="Library" />
    
    <preference name="iosPersistentFileLocation" value="Compatibility" />
    

Sans cette ligne, le fichier plugin utilisera la valeur par défaut « Compatibilité ». Si une balise de préférence est présente et n'est pas une des valeurs suivantes, l'application ne démarrera pas.

Si votre application a déjà été expédiée aux utilisateurs, en utilisant une ancienne (avant 1.0) version de ce plugin et dispose des fichiers stockés dans le système de fichiers persistant, alors vous devez définir la préférence à la « Compatibilité ». L'emplacement de la « Bibliothèque » de commutation signifierait que les utilisateurs existants qui mettre à niveau leur application serait incapables d'accéder à leurs fichiers déjà enregistrés.

Si votre application est nouvelle ou a jamais précédemment stocké les fichiers dans le système de fichiers persistant, alors le paramètre « Library » est généralement recommandé.