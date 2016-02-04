SSHSRV="travis@fgpv.cloudapp.net"
DESTDIR="/home/travis/www"

if [ "$TRAVIS_REPO_SLUG" == "fgpv-vpgf/fgpv-vpgf" -a "$TRAVIS_PULL_REQUEST" == "false" ]; then
    openssl aes-256-cbc -k "$PW" -out ~/.ssh/id_rsa -in devkey.enc -d
    echo -e "Host *\n\tStrictHostKeyChecking no\n" >> ~/.ssh/config
    chmod 600 ~/.ssh/id_rsa
    eval `ssh-agent -s`
    ssh-add ~/.ssh/id_rsa

    if [ -n "$TRAVIS_TAG" ]; then
        DESTDIR="$DESTDIR/$TRAVIS_TAG/"

        FILES=$(find build -type f)
        for f in $FILES;
        do
          # echo "Processing $f file..."
          # uploading to blob
          azure storage blob upload $f rock "$TRAVIS_TAG/$f"
        done

    else
        DESTDIR="$DESTDIR/$TRAVIS_BRANCH/"
    fi

    echo "Destintation: $DESTDIR"
    ssh "$SSHSRV" mkdir -p "$DESTDIR"
    rsync -av --delete "build/" "$SSHSRV:$DESTDIR"
fi
